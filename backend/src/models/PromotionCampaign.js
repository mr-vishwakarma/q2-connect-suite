const mongoose = require('mongoose');

const promotionCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED'],
      default: 'PERCENTAGE',
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number },
    maxUses: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },
    applicablePlans: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Plan' }],
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

promotionCampaignSchema.index({ isActive: 1, validUntil: 1 });

module.exports = mongoose.model('PromotionCampaign', promotionCampaignSchema);
