const { User } = require("../models");

const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.authData.user_id;

      const user = await User.findOne({
        where: { user_id: userId },
        attributes: ['role']
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('User role:', user);

      const userRole = user.role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.authData.role = userRole;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

module.exports = { checkRole };