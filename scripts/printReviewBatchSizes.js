// scripts/printReviewBatchSizes.js
const { printReviewBatchSizes } = require('../lib/storage');

(async () => {
  await printReviewBatchSizes();
  process.exit(0);
})(); 