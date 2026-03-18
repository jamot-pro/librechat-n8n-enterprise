const axios = require('axios');
const logger = require('~/config/winston');

class WhatsAppIntegration {
  constructor() {
    this.apiToken = process.env.WHATSAPP_API_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.enabled = !!(this.apiToken && this.phoneNumberId);

    if (!this.enabled) {
      logger.warn(
        '[WhatsApp] WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set. WhatsApp sending disabled.',
      );
    } else {
      logger.info(`[WhatsApp] Initialized — phoneNumberId=${this.phoneNumberId} tokenPrefix=${this.apiToken.slice(0, 10)}...`);
    }
  }

  /**
   * Send a text message via Meta WhatsApp Cloud API.
   * @param {string} to - Recipient phone number in international format (e.g. +1234567890)
   * @param {string} text - Message body
   */
  async sendMessage(to, text) {
    if (!this.enabled) {
      logger.warn('[WhatsApp] Skipping sendMessage — integration disabled.');
      return;
    }

    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  /**
   * Send the hello_world template to open a conversation.
   * Required for the first outbound message to a user who hasn't messaged us first.
   * @param {string} to - Recipient phone number in international format
   */
  async sendTemplateGreeting(to) {
    if (!this.enabled) {
      logger.warn('[WhatsApp] Skipping sendTemplateGreeting — integration disabled.');
      return;
    }

    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;

    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

module.exports = new WhatsAppIntegration();
