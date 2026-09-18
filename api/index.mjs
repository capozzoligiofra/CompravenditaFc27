// Funzione serverless per il deploy (Vercel & simili): usa lo stesso
// instradamento del server locale, ma i file statici li serve la piattaforma.

import { handleRequest } from '../server/router.mjs'

export default function handler(req, res) {
  handleRequest(req, res, { withStatic: false })
}
