require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
});

const profileSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

async function deleteTestUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const testEmails = ['ceo@librechat.test', 'employee@librechat.test', 'customer@librechat.test'];

    for (const email of testEmails) {
      const user = await User.findOne({ email });
      if (user) {
        await Profile.deleteOne({ userId: user._id });
        await User.deleteOne({ email });
        console.log(`✅ Deleted user: ${email}`);
      } else {
        console.log(`⚠️  User not found: ${email}`);
      }
    }

    console.log('\n✅ All test users deleted!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

deleteTestUsers();
