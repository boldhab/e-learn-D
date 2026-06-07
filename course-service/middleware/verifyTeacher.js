const axios = require('axios');

const verifyTeacher = async (req, res, next) => {
  const token = req.headers.authorization;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const response = await axios.get(`${process.env.AUTH_SERVICE_URL}/auth/me`, {
      headers: { Authorization: token }
    });
    
    if (response.data.role !== 'TEACHER') {
      return res.status(403).json({ error: 'Only teachers can perform this action' });
    }
    
    req.user = response.data;
    next();
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = verifyTeacher;
