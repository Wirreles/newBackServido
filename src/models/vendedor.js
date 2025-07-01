const { db } = require('../firebase');
const crypto = require('crypto');
const axios = require('axios');
const Subscription = require('./subscription');

class Vendedor {
  static async getByUserId(userId) {
    const vendedorRef = db.collection('users').doc(userId);
    const doc = await vendedorRef.get();
    
    if (!doc.exists) return null;

    const userData = doc.data();
    const subscription = await Subscription.getByUserId(userId);

    return {
      userId: doc.id,
      mercadopagoConnected: userData.mercadopagoConnected || false,
      mercadopago: userData.mercadopago ? {
        access_token: this.decryptToken(userData.mercadopago.access_token),
        refresh_token: this.decryptToken(userData.mercadopago.refresh_token),
        expires_at: userData.mercadopago.expires_at,
        user_id: userData.mercadopago.user_id
      } : null,
      subscription,
      storeInfo: userData.storeInfo || {
        name: '',
        description: '',
        logo: '',
        address: '',
        phone: ''
      }
    };
  }

  static async updateMercadoPagoCredentials(userId, credentials) {
    const { access_token, refresh_token, user_id, expires_in, email, nickname, site_id, country } = credentials;
    
    const encryptedAccessToken = this.encryptToken(access_token);
    const encryptedRefreshToken = this.encryptToken(refresh_token);
    
    const vendedorRef = db.collection('users').doc(userId);
    
    await vendedorRef.set({
      mercadopago: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: new Date(Date.now() + expires_in * 1000),
        user_id,
        email: email || null,
        nickname: nickname || null,
        site_id: site_id || null,
        country: country || null,
        connected_at: new Date().toISOString()
      },
      mercadopagoConnected: true,
      updatedAt: new Date()
    }, { merge: true });
  }

  static async updateStoreInfo(userId, storeInfo) {
    const vendedorRef = db.collection('users').doc(userId);
    await vendedorRef.set({
      storeInfo,
      updatedAt: new Date()
    }, { merge: true });
  }

  static async disconnectMercadoPago(userId) {
    const vendedorRef = db.collection('users').doc(userId);
    await vendedorRef.update({
      mercadopago: null,
      mercadopagoConnected: false,
      updatedAt: new Date()
    });
  }

  static encryptToken(token) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  static decryptToken(encryptedToken) {
    if (!encryptedToken) return null;
    
    const [ivHex, encrypted, authTagHex] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(process.env.ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static async verifyAndRefreshToken(userId) {
    const vendedor = await this.getByUserId(userId);
    if (!vendedor || !vendedor.mercadopago) {
      throw new Error('Vendedor no conectado a MercadoPago');
    }

    const expiresAt = new Date(vendedor.mercadopago.expires_at);
    const now = new Date();

    // Renovar si expira en menos de 1 hora
    if (expiresAt.getTime() - now.getTime() < 3600000) {
      return await this.refreshToken(userId);
    }

    return vendedor.mercadopago.access_token;
  }

  static async refreshToken(userId) {
    const vendedor = await this.getByUserId(userId);
    if (!vendedor || !vendedor.mercadopago?.refresh_token) {
      throw new Error('No hay refresh token disponible');
    }

    const response = await axios.post('https://api.mercadopago.com/oauth/token', {
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: vendedor.mercadopago.refresh_token
    });

    await this.updateMercadoPagoCredentials(userId, response.data);
    return response.data.access_token;
  }
}

module.exports = Vendedor; 