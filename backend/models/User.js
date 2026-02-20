const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  avatar: {
    type: String,
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  lastLogin: {
    type: Date,
  },
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
  },
  refreshToken: {
    type: String,
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light',
    },
    language: {
      type: String,
      default: 'en',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      alerts: { type: Boolean, default: true },
    },
    dashboard: {
      defaultView: { type: String, default: 'overview' },
      chartType: { type: String, default: 'area' },
      dateRange: { type: String, default: 'last30' },
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
  },
  assignedSellers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
  }],
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  cometChatUid: {
    type: String,
    index: true,
  },
}, { timestamps: true });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for isLocked
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function () {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // 30 minutes
  }

  return this.updateOne(updates);
};

// Method to get permissions
userSchema.methods.getPermissions = async function () {
  if (!this.role) return [];

  const Role = mongoose.model('Role');
  const role = await Role.findById(this.role).populate('permissions');

  if (!role || !role.isActive) return [];

  return role.permissions || [];
};

// Method to check if user has permission
userSchema.methods.hasPermission = async function (permissionName) {
  const permissions = await this.getPermissions();
  return permissions.some(p => p.name === permissionName);
};

// Method to check if user has any of the permissions
userSchema.methods.hasAnyPermission = async function (permissionNames) {
  const permissions = await this.getPermissions();
  return permissionNames.some(name => permissions.some(p => p.name === name));
};

// Method to check if user has all permissions
userSchema.methods.hasAllPermissions = async function (permissionNames) {
  const permissions = await this.getPermissions();
  return permissionNames.every(name => permissions.some(p => p.name === name));
};

// JSON transformation
userSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    return ret;
  },
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
