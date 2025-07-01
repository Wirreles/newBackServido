const { db } = require('../firebase');

class Subscription {
  static async create(data) {
    const {
      userId,
      planType,
      paymentId,
      autoRenew = true
    } = data;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // Plan mensual

    const subscriptionData = {
      userId,
      status: 'active',
      planType,
      startDate,
      endDate,
      paymentId,
      autoRenew,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('subscriptions').add(subscriptionData);
    return { id: docRef.id, ...subscriptionData };
  }

  static async getByUserId(userId) {
    const snapshot = await db.collection('subscriptions')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  static async update(id, data) {
    const subscriptionRef = db.collection('subscriptions').doc(id);
    await subscriptionRef.update({
      ...data,
      updatedAt: new Date()
    });
  }

  static async cancel(id) {
    await this.update(id, {
      status: 'cancelled',
      autoRenew: false
    });
  }

  static async verifyActive(userId) {
    const subscription = await this.getByUserId(userId);
    if (!subscription) return false;

    const now = new Date();
    const endDate = subscription.endDate.toDate();

    if (endDate < now) {
      await this.update(subscription.id, { status: 'expired' });
      return false;
    }

    return true;
  }

  static getPlanPrice(planType) {
    return planType === 'basic' ? 999 : 1999;
  }
}

module.exports = Subscription; 