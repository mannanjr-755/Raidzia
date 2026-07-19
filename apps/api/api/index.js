/**
 * Vercel serverless entry — load compiled Express app from colocated build output.
 * buildCommand copies apps/api/dist → apps/api/api/_app before this runs.
 */
module.exports = require('./_app/index.js').default || require('./_app/index.js');
