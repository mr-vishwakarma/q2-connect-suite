const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');

async function seedQ2Subscription() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const q2Org = await Organization.findOne({
      $or: [
        { slug: 'q2-hostels' },
        { _id: new mongoose.Types.ObjectId('6a8c4c75a58a07e75037d911') }
      ]
    });

    if (!q2Org) {
      console.error('❌ Q2 organization not found');
      process.exit(1);
    }

    console.log(`Found Q2 Organization: ${q2Org.name} (${q2Org._id})`);

    const enterprisePlan = await Plan.findOne({ code: 'ENTERPRISE' }) ||
      await Plan.findOne({ code: 'PROFESSIONAL' }) ||
      await Plan.findOne();

    if (!enterprisePlan) {
      console.error('❌ No Plan found in database');
      process.exit(1);
    }

    console.log(`Assigning Plan: ${enterprisePlan.name} (${enterprisePlan.code})`);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    let sub = await Subscription.findOne({ organizationId: q2Org._id });
    if (!sub) {
      sub = await Subscription.create({
        organizationId: q2Org._id,
        planId: enterprisePlan._id,
        status: 'ACTIVE',
        billingCycle: 'YEARLY',
        amount: enterprisePlan.priceYearly,
        currency: 'INR',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        usage: {
          studentCount: 0,
          roomCount: 0,
          hostelCount: 3,
          staffCount: 1,
        },
      });
      console.log(`✅ Created active subscription for Q2: ${sub._id}`);
    } else {
      sub.planId = enterprisePlan._id;
      sub.status = 'ACTIVE';
      sub.billingCycle = 'YEARLY';
      sub.amount = enterprisePlan.priceYearly;
      sub.currency = 'INR';
      if (!sub.currentPeriodEnd || sub.currentPeriodEnd < now) {
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = periodEnd;
      }
      await sub.save();
      console.log(`✅ Updated active subscription for Q2: ${sub._id}`);
    }

    q2Org.subscriptionId = sub._id;
    q2Org.status = 'ACTIVE';
    await q2Org.save();
    console.log(`✅ Linked Subscription ${sub._id} to Q2 Organization`);

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error seeding Q2 subscription:', err);
    process.exit(1);
  }
}

seedQ2Subscription();
