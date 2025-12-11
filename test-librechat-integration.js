/**
 * Test Script for LibreChat Integration Endpoints
 * Tests all Executive and Operational module endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3080';
const N8N_WEBHOOK_URL = 'https://nadyaputriast-n8n.hf.space';

// Test data
const TEST_JWT_TOKEN = 'your-test-jwt-token-here';

// Profile contexts
const contexts = {
  ceo: {
    profileType: 'ceo',
    userId: 'ceo123',
    username: 'ceo@example.com',
  },
  employee: {
    profileType: 'employee',
    userId: 'emp456',
    username: 'employee@example.com',
  },
  customer: {
    profileType: 'customer',
    userId: 'cust789',
    username: 'customer@example.com',
  },
};

// Helper function to make requests
async function testEndpoint(endpoint, method, data, description, profileType) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${description}`);
  console.log(`Endpoint: ${method} ${endpoint}`);
  console.log(`Profile: ${profileType || 'None'}`);
  console.log('-'.repeat(80));

  try {
    const config = {
      method: method,
      url: `${BASE_URL}${endpoint}`,
      data: data,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add auth header if profileType specified
    if (profileType) {
      config.headers.Authorization = `Bearer ${TEST_JWT_TOKEN}`;
    }

    const response = await axios(config);

    console.log(`✓ Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      console.log(`✗ Status: ${error.response.status}`);
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
      return { success: false, error: error.response.data };
    } else {
      console.log(`✗ Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// Direct n8n webhook tests (bypass LibreChat)
async function testDirectN8nWebhook(endpoint, data, description) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`DIRECT N8N TEST: ${description}`);
  console.log(`Endpoint: POST ${endpoint}`);
  console.log('-'.repeat(80));

  try {
    const response = await axios.post(`${N8N_WEBHOOK_URL}${endpoint}`, data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`✓ Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      console.log(`✗ Status: ${error.response.status}`);
      console.log('Error Response:', JSON.stringify(error.response.data, null, 2));
      return { success: false, error: error.response.data };
    } else {
      console.log(`✗ Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function runTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         LibreChat Integration Endpoints - Test Suite                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('\nNOTE: Make sure the server is running and you have a valid JWT token!');
  console.log(`Server URL: ${BASE_URL}`);
  console.log(`N8n URL: ${N8N_WEBHOOK_URL}\n`);

  const results = [];

  // ============================================
  // PART 1: DIRECT N8N WEBHOOK TESTS
  // ============================================
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    PART 1: DIRECT N8N WEBHOOK TESTS                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  // Test 1: Financial Analytics (direct n8n)
  results.push(
    await testDirectN8nWebhook(
      '/webhook/librechat/financial-analytics',
      { _context: contexts.ceo, period: 'Q4 2024' },
      'Financial Analytics - Direct n8n webhook',
    ),
  );

  // Test 2: Company Metrics (direct n8n)
  results.push(
    await testDirectN8nWebhook(
      '/webhook/librechat/company-metrics',
      { _context: contexts.ceo },
      'Company Metrics - Direct n8n webhook',
    ),
  );

  // Test 3: Task Management (direct n8n)
  results.push(
    await testDirectN8nWebhook(
      '/webhook/librechat/task-management',
      { _context: contexts.employee, action: 'list', status: 'pending' },
      'Task Management - Direct n8n webhook',
    ),
  );

  // Test 4: Support Ticket (direct n8n)
  results.push(
    await testDirectN8nWebhook(
      '/webhook/librechat/support-ticket',
      {
        _context: contexts.customer,
        action: 'create',
        subject: 'Test ticket',
        priority: 'high',
      },
      'Support Ticket - Direct n8n webhook',
    ),
  );

  // Test 5: Project Status (direct n8n)
  results.push(
    await testDirectN8nWebhook(
      '/webhook/librechat/project-status',
      { _context: contexts.customer, projectId: 'PRJ-001' },
      'Project Status - Direct n8n webhook',
    ),
  );

  // ============================================
  // PART 2: LIBRECHAT INTEGRATION TESTS
  // ============================================
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              PART 2: LIBRECHAT INTEGRATION ENDPOINT TESTS                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  // Test 6: Health Check
  results.push(
    await testEndpoint('/api/librechat/health', 'GET', null, 'Health Check - No auth required'),
  );

  // ============================================
  // EXECUTIVE MODULE TESTS
  // ============================================
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        EXECUTIVE MODULE TESTS                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  // Test 7: Financial Analytics (CEO)
  results.push(
    await testEndpoint(
      '/api/librechat/financial-analytics',
      'POST',
      { period: 'Q4 2024' },
      'Financial Analytics - CEO access',
      'ceo',
    ),
  );

  // Test 8: Company Metrics (CEO)
  results.push(
    await testEndpoint(
      '/api/librechat/company-metrics',
      'POST',
      {},
      'Company Metrics - CEO access',
      'ceo',
    ),
  );

  // Test 9: Financial Analytics - Wrong profile (should fail)
  results.push(
    await testEndpoint(
      '/api/librechat/financial-analytics',
      'POST',
      { period: 'Q4 2024' },
      'Financial Analytics - Employee access (should fail)',
      'employee',
    ),
  );

  // ============================================
  // OPERATIONAL MODULE TESTS
  // ============================================
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                       OPERATIONAL MODULE TESTS                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  // Test 10: Task Management (Employee)
  results.push(
    await testEndpoint(
      '/api/librechat/task-management',
      'POST',
      { action: 'list', status: 'pending' },
      'Task Management - Employee access',
      'employee',
    ),
  );

  // Test 11: Support Ticket (Customer)
  results.push(
    await testEndpoint(
      '/api/librechat/support-ticket',
      'POST',
      { action: 'create', subject: 'Test ticket', priority: 'high' },
      'Support Ticket - Customer access',
      'customer',
    ),
  );

  // Test 12: Project Status (Customer)
  results.push(
    await testEndpoint(
      '/api/librechat/project-status',
      'POST',
      { projectId: 'PRJ-001' },
      'Project Status - Customer access',
      'customer',
    ),
  );

  // Test 13: Task Management - Wrong profile (should fail)
  results.push(
    await testEndpoint(
      '/api/librechat/task-management',
      'POST',
      { action: 'list' },
      'Task Management - Customer access (should fail)',
      'customer',
    ),
  );

  // ============================================
  // GENERAL ACCESS TESTS
  // ============================================
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          GENERAL ACCESS TESTS                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  // Test 14: Document Search (All profiles)
  results.push(
    await testEndpoint(
      '/api/librechat/document-search',
      'POST',
      { query: 'test search' },
      'Document Search - CEO access',
      'ceo',
    ),
  );

  results.push(
    await testEndpoint(
      '/api/librechat/document-search',
      'POST',
      { query: 'test search' },
      'Document Search - Employee access',
      'employee',
    ),
  );

  results.push(
    await testEndpoint(
      '/api/librechat/document-search',
      'POST',
      { query: 'test search' },
      'Document Search - Customer access',
      'customer',
    ),
  );

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              TEST SUMMARY                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log('\n');
}

// Run tests
runTests().catch((error) => {
  console.error('\nTest suite failed:', error);
  process.exit(1);
});
