# Roblox Terms of Service Compliance Audit

**Date of Audit:** May 2026
**Tool:** Roblox Thumbnail Dataset Builder

This document outlines how this project complies with the Roblox Terms of Use, specifically regarding data scraping, API usage, and content storage.

## 1. Allowed APIs
**Compliance Strategy:** 
The tool exclusively uses official, public Roblox endpoints hosted under `https://thumbnails.roblox.com`. We do NOT scrape HTML from `www.roblox.com` or attempt to bypass security measures (e.g., Cloudflare CAPTCHAs).
- `GET /v1/users/avatar-headshot`
- `GET /v1/games/icons`

## 2. Rate Limiting and Fair Use
**Compliance Strategy:**
Roblox strictly prohibits automated tools that degrade platform performance. 
- **Implementation:** The `RobloxApiClient` utilizes the `bottleneck` library to enforce a strict rate limit.
- **Rules:** Maximum 10 concurrent requests, minimum 200ms delay between requests.
- **Batching:** We utilize Roblox's official batching endpoints (up to 100 IDs per request) to minimize the number of HTTP calls made to their servers.

## 3. Idempotency and Deduplication
**Compliance Strategy:**
To prevent unnecessary repetitive requests to Roblox CDNs, the tool implements:
- **Database Idempotency:** We check the local SQLite/PostgreSQL database before requesting a thumbnail. If the exact size, crop type, and target ID exist and are fresh, the API call is skipped.
- **Caching:** The application utilizes a Redis cache layer for raw API responses.
- **Perceptual Hashing (pHash):** Duplicate avatars (e.g., default "noob" avatars) are identified locally via Sharp/imghash without re-downloading or re-evaluating them against the Roblox CDN.

## 4. Handling "Blocked" and "Error" States
**Compliance Strategy:**
Roblox occasionally returns states like `Blocked`, `InReview`, or `Error` for thumbnails that violate their community guidelines.
- **Implementation:** The `thumbnailWorker` actively checks the `state` property of the API response. Images in these states are **skipped entirely** and not downloaded, ensuring we do not circumvent Roblox's moderation systems or store inappropriate content.

## 5. Storage of Personally Identifiable Information (PII)
**Compliance Strategy:**
- The dataset only associates an image with a numeric `robloxId`.
- We do not scrape or store usernames, real names, or chat logs.
- Avatars are considered public, user-generated content representations.

## Conclusion
This tool operates strictly as a responsible consumer of Roblox's public APIs. It employs exponential backoff, circuit breakers, rate limiting, and caching to ensure it remains a "good citizen" of the Roblox ecosystem. Operators must not modify the rate limits to aggressively spam the API, as this would constitute a ToS violation.
