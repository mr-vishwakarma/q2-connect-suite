const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      default: 'RAZORPAY',
      required: true,
      index: true,
    },
    // The provider's unique event identifier (e.g. header x-razorpay-event-id or payload id)
    providerEventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'],
      default: 'RECEIVED',
      index: true,
    },
    processedAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    processingAttempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
webhookEventSchema.index({ status: 1, createdAt: -1 });
webhookEventSchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
