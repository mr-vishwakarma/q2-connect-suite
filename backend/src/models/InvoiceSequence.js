const mongoose = require('mongoose');

const invoiceSequenceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
    },
    prefix: {
      type: String,
      default: 'Q2-INV',
      trim: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

invoiceSequenceSchema.index({ organizationId: 1, year: 1, prefix: 1 }, { unique: true });

/**
 * Atomically generates the next sequential invoice number for an organization.
 * e.g. Q2-INV-2026-000001
 * Concurrency-safe: uses MongoDB findOneAndUpdate with $inc
 */
invoiceSequenceSchema.statics.getNextInvoiceNumber = async function (organizationId, prefix = 'Q2-INV', year = new Date().getFullYear()) {
  const record = await this.findOneAndUpdate(
    { organizationId, year, prefix },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const paddedSeq = String(record.seq).padStart(6, '0');
  return `${prefix}-${year}-${paddedSeq}`;
};

module.exports = mongoose.model('InvoiceSequence', invoiceSequenceSchema);
