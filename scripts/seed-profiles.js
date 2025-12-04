require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define User schema directly (simple approach)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String },
  username: { type: String },
  avatar: { type: String },
  role: { type: String, default: 'user', enum: ['user', 'admin'] },
  provider: { type: String, required: true, default: 'local' },
  emailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create User model
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Import Profile model
const Profile = require('../api/server/models/Profile');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;

// Workflow mappings per profile type
const WORKFLOW_MAPPINGS = {
  ceo: [
    {
      workflowId: 'wf_financial_analytics',
      workflowName: 'Financial Analytics Dashboard',
      endpoint: '/webhook/librechat/financial-analytics',
      description: 'Get comprehensive financial metrics and reports',
    },
    {
      workflowId: 'wf_company_metrics',
      workflowName: 'Company Performance Metrics',
      endpoint: '/webhook/librechat/company-metrics',
      description: 'View KPIs across all departments',
    },
  ],
  employee: [
    {
      workflowId: 'wf_doc_search',
      workflowName: 'Document Search',
      endpoint: '/webhook/librechat/doc-search',
      description: 'Search internal documentation and policies',
    },
    {
      workflowId: 'wf_task_management',
      workflowName: 'Task Management',
      endpoint: '/webhook/librechat/task-management',
      description: 'Create and manage your tasks',
    },
  ],
  customer: [
    {
      workflowId: 'wf_support_ticket',
      workflowName: 'Create Support Ticket',
      endpoint: '/webhook/librechat/support-ticket',
      description: 'Submit support requests and track issues',
    },
    {
      workflowId: 'wf_project_status',
      workflowName: 'Project Status',
      endpoint: '/webhook/librechat/project-status',
      description: 'Check your project progress and milestones',
    },
  ],
};

const PERMISSION_SETS = {
  ceo: ['full_analytics', 'financial_data', 'all_departments', 'strategic_planning'],
  employee: ['department_data', 'personal_records', 'team_collaboration', 'knowledge_base'],
  customer: ['own_projects', 'support_history', 'billing_info', 'public_docs'],
};

// Test users
const TEST_USERS = [
  {
    email: 'ceo@librechat.test',
    password: 'ceo12345',
    name: 'CEO User',
    profileType: 'ceo',
  },
  {
    email: 'employee@librechat.test',
    password: 'emp12345',
    name: 'Employee User',
    profileType: 'employee',
  },
  {
    email: 'customer@librechat.test',
    password: 'cust12345',
    name: 'Customer User',
    profileType: 'customer',
  },
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Process each test user
    for (const userData of TEST_USERS) {
      console.log(`📝 Processing user: ${userData.email}`);

      // Check if user exists
      let user = await User.findOne({ email: userData.email });

      if (user) {
        console.log(`   ⚠️  User already exists, skipping user creation`);
      } else {
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Create user
        user = await User.create({
          email: userData.email,
          password: hashedPassword,
          name: userData.name,
          username: userData.email.split('@')[0],
          provider: 'local',
          role: 'user',
        });

        console.log(`   ✅ User created`);
      }

      // Check if profile exists
      let profile = await Profile.findOne({ userId: user._id });

      if (profile) {
        console.log(`   ⚠️  Profile already exists, updating...`);

        // Update existing profile
        profile.profileType = userData.profileType;
        profile.permissions = PERMISSION_SETS[userData.profileType];
        profile.allowedWorkflows = WORKFLOW_MAPPINGS[userData.profileType];
        profile.updatedAt = new Date();

        await profile.save();
        console.log(`   ✅ Profile updated`);
      } else {
        // Create new profile
        {
          // determine security level without nested ternary
          let securityLevel;
          if (userData.profileType === 'ceo') {
            securityLevel = 5;
          } else if (userData.profileType === 'employee') {
            securityLevel = 3;
          } else {
            securityLevel = 1;
          }

          profile = await Profile.create({
            userId: user._id,
            profileType: userData.profileType,
            permissions: PERMISSION_SETS[userData.profileType],
            allowedWorkflows: WORKFLOW_MAPPINGS[userData.profileType],
            metadata: {
              department: userData.profileType === 'employee' ? 'Engineering' : null,
              customerId: userData.profileType === 'customer' ? `CUST_${Date.now()}` : null,
              securityLevel: securityLevel,
              companyId: 'COMPANY_001',
            },
          });
        }

        console.log(`   ✅ Profile created with ${profile.allowedWorkflows.length} workflows`);
      }

      console.log('');
    }

    console.log('='.repeat(60));
    console.log('🎉 DATABASE SEEDING COMPLETED!\n');

    console.log('📋 TEST CREDENTIALS:\n');
    TEST_USERS.forEach((user) => {
      console.log(`${user.profileType.toUpperCase()}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
      console.log(`  Workflows: ${WORKFLOW_MAPPINGS[user.profileType].length}\n`);
    });

    console.log('='.repeat(60));
    console.log('\n✅ You can now login to LibreChat with these credentials!');
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run seeding
seedDatabase();
