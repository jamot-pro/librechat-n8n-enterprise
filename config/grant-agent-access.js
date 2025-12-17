const mongoose = require('mongoose');
require('dotenv').config();

// Define User schema directly
const userSchema = new mongoose.Schema(
  {
    email: String,
    password: String,
    name: String,
    username: String,
    permissions: Object,
  },
  { strict: false },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

const grantAgentAccess = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const email = 'ceo@librechat.test';
    const user = await User.findOne({ email });

    if (!user) {
      console.error(`User ${email} not found`);
      process.exit(1);
    }

    console.log('Current user permissions:', user.permissions);

    // Grant full agent permissions
    if (!user.permissions) {
      user.permissions = {};
    }

    user.permissions.agents = ['use', 'create', 'shared_global'];

    await user.save();

    console.log('✅ Agent permissions granted!');
    console.log('New permissions:', user.permissions);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

grantAgentAccess();
