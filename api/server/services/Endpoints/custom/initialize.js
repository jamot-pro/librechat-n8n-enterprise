const { isUserProvided, getOpenAIConfig, getCustomEndpointConfig } = require('@librechat/api');
const {
  CacheKeys,
  ErrorTypes,
  envVarRegex,
  FetchTokenConfig,
  extractEnvVariable,
} = require('librechat-data-provider');
const { getUserKeyValues, checkUserKeyExpiry } = require('~/server/services/UserService');
const { fetchModels } = require('~/server/services/ModelService');
const OpenAIClient = require('~/app/clients/OpenAIClient');
const getLogStores = require('~/cache/getLogStores');
const n8nToolExecutor = require('~/server/services/N8nToolExecutor');
const { logger } = require('@librechat/data-schemas');

const { PROXY } = process.env;

const initializeClient = async ({ req, res, endpointOption, optionsOnly, overrideEndpoint }) => {
  const appConfig = req.config;
  const { key: expiresAt } = req.body;
  const endpoint = overrideEndpoint ?? req.body.endpoint;

  const endpointConfig = getCustomEndpointConfig({
    endpoint,
    appConfig,
  });
  if (!endpointConfig) {
    throw new Error(`Config not found for the ${endpoint} custom endpoint.`);
  }

  const CUSTOM_API_KEY = extractEnvVariable(endpointConfig.apiKey);
  const CUSTOM_BASE_URL = extractEnvVariable(endpointConfig.baseURL);

  if (CUSTOM_API_KEY.match(envVarRegex)) {
    throw new Error(`Missing API Key for ${endpoint}.`);
  }

  if (CUSTOM_BASE_URL.match(envVarRegex)) {
    throw new Error(`Missing Base URL for ${endpoint}.`);
  }

  const userProvidesKey = isUserProvided(CUSTOM_API_KEY);
  const userProvidesURL = isUserProvided(CUSTOM_BASE_URL);

  let userValues = null;
  if (expiresAt && (userProvidesKey || userProvidesURL)) {
    checkUserKeyExpiry(expiresAt, endpoint);
    userValues = await getUserKeyValues({ userId: req.user.id, name: endpoint });
  }

  let apiKey = userProvidesKey ? userValues?.apiKey : CUSTOM_API_KEY;
  let baseURL = userProvidesURL ? userValues?.baseURL : CUSTOM_BASE_URL;

  if (userProvidesKey & !apiKey) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_USER_KEY,
      }),
    );
  }

  if (userProvidesURL && !baseURL) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_BASE_URL,
      }),
    );
  }

  if (!apiKey) {
    throw new Error(`${endpoint} API key not provided.`);
  }

  if (!baseURL) {
    throw new Error(`${endpoint} Base URL not provided.`);
  }

  const cache = getLogStores(CacheKeys.TOKEN_CONFIG);
  const tokenKey =
    !endpointConfig.tokenConfig && (userProvidesKey || userProvidesURL)
      ? `${endpoint}:${req.user.id}`
      : endpoint;

  let endpointTokenConfig =
    !endpointConfig.tokenConfig &&
    FetchTokenConfig[endpoint.toLowerCase()] &&
    (await cache.get(tokenKey));

  if (
    FetchTokenConfig[endpoint.toLowerCase()] &&
    endpointConfig &&
    endpointConfig.models.fetch &&
    !endpointTokenConfig
  ) {
    await fetchModels({ apiKey, baseURL, name: endpoint, user: req.user.id, tokenKey });
    endpointTokenConfig = await cache.get(tokenKey);
  }

  const customOptions = {
    headers: endpointConfig.headers,
    addParams: endpointConfig.addParams,
    dropParams: endpointConfig.dropParams,
    customParams: endpointConfig.customParams,
    titleConvo: endpointConfig.titleConvo,
    titleModel: endpointConfig.titleModel,
    forcePrompt: endpointConfig.forcePrompt,
    summaryModel: endpointConfig.summaryModel,
    modelDisplayLabel: endpointConfig.modelDisplayLabel,
    titleMethod: endpointConfig.titleMethod ?? 'completion',
    contextStrategy: endpointConfig.summarize ? 'summarize' : null,
    directEndpoint: endpointConfig.directEndpoint,
    titleMessageRole: endpointConfig.titleMessageRole,
    streamRate: endpointConfig.streamRate,
    endpointTokenConfig,
  };

  const allConfig = appConfig.endpoints?.all;
  if (allConfig) {
    customOptions.streamRate = allConfig.streamRate;
  }

  let clientOptions = {
    reverseProxyUrl: baseURL ?? null,
    proxy: PROXY ?? null,
    req,
    res,
    ...customOptions,
    ...endpointOption,
  };

  if (optionsOnly) {
    const modelOptions = endpointOption?.model_parameters ?? {};
    clientOptions = Object.assign(
      {
        modelOptions,
      },
      clientOptions,
    );
    clientOptions.modelOptions.user = req.user.id;

    // === N8N TOOLS INJECTION (optionsOnly path) ===
    logger.info('[Custom Initialize] === N8N TOOLS INJECTION START (optionsOnly path) ===');
    try {
      if (req.user && req.user.id) {
        logger.info('[Custom Initialize] Loading n8n tools for user:', req.user.id);
        const n8nTools = await n8nToolExecutor.loadUserTools({ _id: req.user.id });

        logger.info('[Custom Initialize] Tools loaded:', {
          toolCount: n8nTools?.length || 0,
          toolNames: n8nTools?.map((t) => t.function?.name) || [],
        });

        if (n8nTools && n8nTools.length > 0) {
          clientOptions.modelOptions.tools = n8nTools;
          logger.info(
            `[Custom Initialize] ✅ Injected ${n8nTools.length} n8n tools into optionsOnly path`,
          );
        }
      }
    } catch (error) {
      logger.error('[Custom Initialize] ❌ Error loading n8n tools (optionsOnly path):', error);
    }
    logger.info('[Custom Initialize] === N8N TOOLS INJECTION END (optionsOnly path) ===');

    const options = getOpenAIConfig(apiKey, clientOptions, endpoint);
    if (options != null) {
      options.useLegacyContent = true;
      options.endpointTokenConfig = endpointTokenConfig;
    }
    if (!clientOptions.streamRate) {
      return options;
    }
    options.llmConfig._lc_stream_delay = clientOptions.streamRate;
    return options;
  }

  // === N8N TOOLS INJECTION (CUSTOM ENDPOINT) ===
  // Load user's n8n workflow tools and inject them into modelOptions
  logger.info('[Custom Initialize] === N8N TOOLS INJECTION START ===');
  logger.info('[Custom Initialize] User object:', {
    hasUser: !!req.user,
    userId: req.user?.id,
    userIdUnderscore: req.user?._id,
  });

  try {
    if (req.user && req.user.id) {
      logger.info('[Custom Initialize] Loading n8n tools for user:', req.user.id);

      const n8nTools = await n8nToolExecutor.loadUserTools({ _id: req.user.id });

      logger.info('[Custom Initialize] Tools loaded:', {
        toolCount: n8nTools?.length || 0,
        toolNames: n8nTools?.map((t) => t.function?.name) || [],
      });

      if (n8nTools && n8nTools.length > 0) {
        // Initialize modelOptions.tools if it doesn't exist
        if (!clientOptions.modelOptions) {
          clientOptions.modelOptions = {};
        }

        // CRITICAL: Remove _metadata from tools (not part of OpenAI spec)
        const cleanTools = n8nTools.map((tool) => ({
          type: tool.type,
          function: tool.function,
        }));

        // Inject n8n tools into modelOptions (OpenAI expects "tools" array)
        clientOptions.modelOptions.tools = cleanTools;

        logger.info(
          `[Custom Initialize] ✅ Successfully injected ${cleanTools.length} n8n tools into clientOptions.modelOptions`,
          {
            userId: req.user.id,
            toolNames: cleanTools.map((t) => t.function?.name),
          },
        );
      } else {
        logger.warn('[Custom Initialize] No tools loaded for user');
      }
    } else {
      logger.warn('[Custom Initialize] No user object or user.id found, skipping n8n tools');
    }
  } catch (error) {
    logger.error('[Custom Initialize] ❌ Error loading n8n tools:', error);
    logger.error('[Custom Initialize] Error stack:', error.stack);
    // Don't block initialization if tool loading fails
  }

  logger.info('[Custom Initialize] === N8N TOOLS INJECTION END ===');

  const client = new OpenAIClient(apiKey, clientOptions);
  return {
    client,
    openAIApiKey: apiKey,
  };
};

module.exports = initializeClient;
