const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Puedes agregar más configuración aquí si usas Firestore, Storage, etc.
  });
}
const { db } = require('../firebase');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'No se proporcionó el header Authorization' });
    }

    // Soporta "Bearer <token>" o solo "<token>"
    const parts = authHeader.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    // Verificar el token con Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const isVendedor = async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userData = userDoc.data();
    // Cambia aquí si tu rol en Firestore es "seller" en vez de "vendedor"
    if (userData.role !== 'seller') {
      return res.status(403).json({ error: 'Acceso denegado: se requiere rol de vendedor' });
    }

    next();
  } catch (error) {
    console.error('Error verificando rol:', error);
    res.status(500).json({ error: 'Error verificando permisos' });
  }
};

module.exports = {
  authenticateToken,
  isVendedor
};