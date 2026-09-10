import type { NextConfig } from "next"
import path from "node:path"

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), ".."),
  poweredByHeader: false,
  cacheComponents: true,
  agentRules: false,
}

export default config
