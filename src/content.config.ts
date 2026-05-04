import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    cover: z.string().optional(),
    coverAlt: z.string().optional()
  })
});

const papers = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    authors: z.string().optional(),
    venue: z.string().optional(),
    paperUrl: z.string().optional()
  })
});

export const collections = { posts, papers };