import type { ProvisioningConfig } from "../pages/provisioning-wizard"

export type TemplateCategory =
  | "blockchain"
  | "ai-ml"
  | "frontend"
  | "infrastructure"
  | "general"

export type TemplatePreset = Omit<ProvisioningConfig, "name" | "gitUrl" | "envVars" | "driver">

const BLOCKCHAIN_PATTERNS = [
  "ethereum", "solana", "arbitrum", "base-aa", "base-l2", "polygon",
  "tangle", "chainlink", "foundry", "hardhat", "optimism", "zksync",
  "starknet", "cosmos", "near", "aptos", "sui", "ton", "injective",
  "gnosis", "linea", "monad", "reth", "soneium", "xlayer",
  "coinbase", "farcaster", "worldcoin", "x402-payments", "xmtp",
  "openzeppelin", "biconomy", "gelato", "hyperlane", "hyperliquid",
  "lifi", "polymer", "risc0", "stylus", "succinct", "fhenix",
  "rindexer", "ai-agent-web3",
]

const AI_ML_PATTERNS = [
  "pytorch", "tensorflow", "huggingface", "chromadb", "langchain",
  "llamaindex", "ai-sdk", "ollama", "vllm", "pgvector", "qdrant",
  "milvus", "weaviate", "mlops", "jupyter", "scientific-python",
]

const FRONTEND_PATTERNS = [
  "react", "next", "vue", "angular", "svelte", "vite", "astro",
  "remix", "gatsby", "nuxt",
]

const INFRASTRUCTURE_PATTERNS = [
  "redis", "postgresql", "mongodb", "kafka", "elasticsearch",
  "clickhouse", "minio", "kubernetes", "terraform", "pulumi",
  "blockscout", "tempo", "convex",
]

function categorizeTemplate(id: string): TemplateCategory {
  const lower = id.toLowerCase()
  if (BLOCKCHAIN_PATTERNS.some((p) => lower.includes(p))) return "blockchain"
  if (AI_ML_PATTERNS.some((p) => lower.includes(p))) return "ai-ml"
  if (FRONTEND_PATTERNS.some((p) => lower.includes(p))) return "frontend"
  if (INFRASTRUCTURE_PATTERNS.some((p) => lower.includes(p))) return "infrastructure"
  return "general"
}

const CATEGORY_DEFAULTS: Record<TemplateCategory, TemplatePreset> = {
  blockchain: {
    environment: "",
    cpuCores: 4,
    ramGB: 16,
    storageGB: 128,
    modelTier: "claude-sonnet",
    systemPrompt:
      "You are a blockchain development assistant. Help with smart contract development, testing, and deployment. Follow security best practices and suggest gas optimizations where relevant.",
    bare: false,
  },
  "ai-ml": {
    environment: "",
    cpuCores: 8,
    ramGB: 32,
    storageGB: 256,
    modelTier: "claude-sonnet",
    systemPrompt:
      "You are an AI/ML development assistant. Help with model training, data processing, and experiment management. Suggest efficient approaches for the available compute resources.",
    bare: false,
  },
  frontend: {
    environment: "",
    cpuCores: 2,
    ramGB: 4,
    storageGB: 50,
    modelTier: "claude-sonnet",
    systemPrompt:
      "You are a frontend development assistant. Help build modern, accessible, and performant user interfaces.",
    bare: false,
  },
  infrastructure: {
    environment: "",
    cpuCores: 4,
    ramGB: 16,
    storageGB: 128,
    modelTier: "claude-sonnet",
    systemPrompt:
      "You are an infrastructure and DevOps assistant. Help with service configuration, deployment, monitoring, and operational best practices.",
    bare: false,
  },
  general: {
    environment: "",
    cpuCores: 4,
    ramGB: 16,
    storageGB: 128,
    modelTier: "claude-sonnet",
    systemPrompt: "",
    bare: false,
  },
}

export function getPresetForTemplate(id: string): TemplatePreset {
  const category = categorizeTemplate(id)
  const defaults = CATEGORY_DEFAULTS[category]
  return { ...defaults, environment: id }
}
