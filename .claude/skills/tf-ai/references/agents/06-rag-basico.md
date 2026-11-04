# Bloque 06: RAG Basico

> Retrieval Augmented Generation con Supabase pgvector.

**Tiempo:** 30 minutos
**Prerequisitos:** Bloque 00 (Setup), Bloque 03 (Supabase configurado)

---

## Que Obtienes

- Base de conocimiento consultable por el agente
- Embeddings almacenados en Supabase
- Busqueda semantica (por significado, no keywords)
- Tool `getInformation` para el chat

---

## Concepto RAG

```
┌─────────────────────────────────────────────────────────────┐
│                      FLUJO RAG                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INDEXACION (una vez):                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Documento│ -> │ Chunking │ -> │ Embeddings│ -> Supabase │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                                             │
│  CONSULTA (cada pregunta):                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌───────┐ │
│  │ Pregunta │ -> │ Embedding│ -> │ Busqueda │ -> │Context│ │
│  └──────────┘    └──────────┘    │ Similitud│    └───┬───┘ │
│                                  └──────────┘        │     │
│                                                      v     │
│                                               ┌──────────┐ │
│                                               │    LLM   │ │
│                                               │ Respuesta│ │
│                                               └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Setup Supabase (SQL)

Ejecutar en el SQL Editor de Supabase:

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- Resources table (original content)
create table resources (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Embeddings table (vectorized chunks)
create table embeddings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references resources(id) on delete cascade,
  content text not null,
  embedding vector(1536), -- Dimension of text-embedding-3-small
  created_at timestamptz default now()
);

-- HNSW index for fast search
create index on embeddings
using hnsw (embedding vector_cosine_ops);

-- Similarity search function
create or replace function match_embeddings(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    embeddings.id,
    embeddings.content,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from embeddings
  where 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  order by embeddings.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## 2. Configurar Embeddings

```typescript
// lib/ai/embeddings.ts

import { embed, embedMany } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'

// Embedding model
const EMBEDDING_MODEL = 'openai/text-embedding-3-small'

// Generate embedding for a text
export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
    value: text,
  })
  return embedding
}

// Generate embeddings for multiple texts
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openrouter.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  })
  return embeddings
}
```

---

## 3. Funciones de Chunking

```typescript
// lib/ai/chunking.ts

interface Chunk {
  content: string
  index: number
}

// Split text into chunks by sentences
// MODIFY: Adjust based on your use case
export function chunkText(text: string, maxChunkSize = 500): Chunk[] {
  // Split by sentences
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0)

  const chunks: Chunk[] = []
  let currentChunk = ''
  let chunkIndex = 0

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
      })
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
    })
  }

  return chunks
}
```

---

## 4. Servicio RAG

```typescript
// lib/ai/rag.ts

import { createClient } from '@/lib/supabase/server'
import { generateEmbedding, generateEmbeddings } from './embeddings'
import { chunkText } from './chunking'

// Add document to the knowledge base
export async function addDocument(content: string, metadata?: Record<string, unknown>) {
  const supabase = await createClient()

  // 1. Save original resource
  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .insert({ content, metadata })
    .select('id')
    .single()

  if (resourceError) throw resourceError

  // 2. Split into chunks
  const chunks = chunkText(content)

  // 3. Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map(c => c.content))

  // 4. Save embeddings
  const embeddingRows = chunks.map((chunk, i) => ({
    resource_id: resource.id,
    content: chunk.content,
    embedding: embeddings[i],
  }))

  const { error: embeddingError } = await supabase
    .from('embeddings')
    .insert(embeddingRows)

  if (embeddingError) throw embeddingError

  return resource.id
}

// Find relevant content
export async function findRelevantContent(
  query: string,
  threshold = 0.5,
  limit = 5
): Promise<{ content: string; similarity: number }[]> {
  const supabase = await createClient()

  // 1. Generate embedding for the question
  const queryEmbedding = await generateEmbedding(query)

  // 2. Search for similar items
  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) throw error

  return data || []
}
```

---

## 5. Tool para el Agente

```typescript
// lib/ai/tools/knowledge.ts

import { z } from 'zod'
import { findRelevantContent, addDocument } from '../rag'

export const knowledgeTools = {
  // Tool to search for information
  getInformation: {
    description: 'Busca informacion relevante en la base de conocimiento',
    parameters: z.object({
      query: z.string().describe('La pregunta o tema a buscar'),
    }),
    execute: async ({ query }: { query: string }) => {
      const results = await findRelevantContent(query)

      if (results.length === 0) {
        return 'No encontre informacion relevante sobre eso.'
      }

      return results
        .map(r => r.content)
        .join('\n\n---\n\n')
    },
  },

  // Tool to add knowledge (optional)
  addKnowledge: {
    description: 'Agrega nueva informacion a la base de conocimiento',
    parameters: z.object({
      content: z.string().describe('El contenido a agregar'),
      source: z.string().optional().describe('Fuente de la informacion'),
    }),
    execute: async ({ content, source }: { content: string; source?: string }) => {
      const id = await addDocument(content, { source })
      return `Informacion agregada con ID: ${id}`
    },
  },
}
```

---

## 6. Integrar con Chat

```typescript
// app/api/chat/route.ts
// MODIFY: Add RAG tools

import { openrouter, MODELS } from '@/lib/ai/openrouter'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { knowledgeTools } from '@/lib/ai/tools/knowledge'

const SYSTEM_PROMPT = `Eres un asistente con acceso a una base de conocimiento.
Cuando el usuario pregunte sobre algo, USA la tool getInformation para buscar.
Basa tus respuestas en la informacion encontrada.
Si no encuentras nada relevante, dilo honestamente.`

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: openrouter(MODELS.balanced),
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: knowledgeTools,
    maxSteps: 3, // Allow multiple tool calls
  })

  return result.toUIMessageStreamResponse()
}
```

---

## 7. Script para Indexar

```typescript
// scripts/index-docs.ts
// Run: npx tsx scripts/index-docs.ts

import { addDocument } from '@/lib/ai/rag'
import fs from 'fs'
import path from 'path'

async function indexDocuments(docsDir: string) {
  const files = fs.readdirSync(docsDir)

  for (const file of files) {
    if (!file.endsWith('.md') && !file.endsWith('.txt')) continue

    const content = fs.readFileSync(path.join(docsDir, file), 'utf-8')
    console.log(`Indexando: ${file}`)

    await addDocument(content, { source: file })
    console.log(`  ✓ Indexado`)
  }

  console.log('Indexacion completa!')
}

// Usage:
indexDocuments('./docs')
```

---

## Optimizaciones

### Hybrid Search (Keyword + Semantico)

```sql
-- Add full-text search
alter table embeddings
add column fts tsvector
generated always as (to_tsvector('spanish', content)) stored;

create index on embeddings using gin(fts);

-- Hybrid search function
create or replace function hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  score float
)
language sql stable
as $$
  select
    e.id,
    e.content,
    (
      -- 60% semantic + 40% keyword
      0.6 * (1 - (e.embedding <=> query_embedding)) +
      0.4 * ts_rank(e.fts, websearch_to_tsquery('spanish', query_text))
    ) as score
  from embeddings e
  where e.fts @@ websearch_to_tsquery('spanish', query_text)
     or 1 - (e.embedding <=> query_embedding) > 0.3
  order by score desc
  limit match_count;
$$;
```

### Cache de Embeddings

```typescript
// Embeddings for the same text are deterministic
// You can cache them to avoid recalculating

import { unstable_cache } from 'next/cache'

export const getCachedEmbedding = unstable_cache(
  async (text: string) => generateEmbedding(text),
  ['embedding'],
  { revalidate: 3600 * 24 } // 24 hours
)
```

---

## Checklist

- [ ] Extension pgvector habilitada en Supabase
- [ ] Tablas `resources` y `embeddings` creadas
- [ ] Funcion `match_embeddings` creada
- [ ] Servicio RAG implementado (`addDocument`, `findRelevantContent`)
- [ ] Tool `getInformation` integrada al agente
- [ ] Script de indexacion funcionando
- [ ] Probado con documentos reales

---

## Siguiente Paso

Con RAG configurado, tu agente puede:
- Responder preguntas sobre documentos
- Citar fuentes de informacion
- Aprender nuevo conocimiento dinámicamente

---

*"Un agente sin conocimiento solo puede adivinar. Con RAG, puede informar."*
