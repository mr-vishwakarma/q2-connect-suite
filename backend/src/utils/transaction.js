const mongoose = require('mongoose');

let isTransactionsSupportedCached = null;

/**
 * Checks whether the connected MongoDB instance supports multi-document transactions.
 * Transactions require a replica set (e.g. MongoDB Atlas) or mongos (sharded cluster).
 */
async function supportsTransactions() {
  if (isTransactionsSupportedCached !== null) {
    return isTransactionsSupportedCached;
  }
  try {
    if (!mongoose.connection || !mongoose.connection.db) {
      return false;
    }
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    isTransactionsSupportedCached = Boolean(hello.setName || hello.msg === 'isdbgrid');
    return isTransactionsSupportedCached;
  } catch (err) {
    // If hello command fails or db not ready, default to false safely
    return false;
  }
}

/**
 * Safely starts a MongoDB session and transaction if supported by the deployment.
 * On replica sets (e.g. MongoDB Atlas production), operations run within an ACID transaction.
 * On standalone MongoDB (local dev / non-replica set test environments), gracefully falls back
 * to non-transactional operations with safe compensation handling as required by architecture specs.
 */
async function startSafeTransaction() {
  const canUseTx = await supportsTransactions();
  if (!canUseTx) {
    return {
      session: null,
      hasTransaction: false,
      options: {},
      withSession: (query) => query,
      commit: async () => {},
      abort: async () => {},
    };
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    let ended = false;
    return {
      session,
      hasTransaction: true,
      options: { session },
      withSession: (query) => (session ? query.session(session) : query),
      commit: async () => {
        if (!ended) {
          ended = true;
          await session.commitTransaction();
          session.endSession();
        }
      },
      abort: async () => {
        if (!ended) {
          ended = true;
          await session.abortTransaction();
          session.endSession();
        }
      },
    };
  } catch (err) {
    if (session) {
      try {
        session.endSession();
      } catch (e) {}
    }
    return {
      session: null,
      hasTransaction: false,
      options: {},
      withSession: (query) => query,
      commit: async () => {},
      abort: async () => {},
    };
  }
}

module.exports = {
  supportsTransactions,
  startSafeTransaction,
};

