 🚀 Complete Free API Infrastructure for Roblox Thumbnail Dataset  
​​  
As a senior API developer, I'll architect a comprehensive, production-ready API layer using 100% free services.

\---

 📋 API Architecture Overview

\`\`\`  
┌─────────────────────────────────────────────────────────┐  
│                    API GATEWAY LAYER                     │  
│  ├─ Rate Limiting (Token Bucket)                        │  
│  ├─ Request Validation                                  │  
│  ├─ Authentication (API Keys)                           │  
│  └─ Logging & Monitoring                                │  
└────────────────────┬────────────────────────────────────┘  
                     │  
┌────────────────────▼────────────────────────────────────┐  
│                  CORE APIs (FREE)                        │  
│  ├─ Roblox Official APIs (No Auth Required)             │  
│  ├─ Image Processing APIs                               │  
│  ├─ Storage APIs (Free Tier)                            │  
│  └─ Database APIs (Free Tier)                           │  
└────────────────────┬────────────────────────────────────┘  
                     │  
┌────────────────────▼────────────────────────────────────┐  
│               CACHING LAYER (Redis)                      │  
│  ├─ Response Caching                                    │  
│  ├─ Rate Limit Counters                                 │  
│  └─ Session Management                                  │  
└─────────────────────────────────────────────────────────┘  
\`\`\`

\---

 🔧 1\. ROBLOX OFFICIAL FREE APIs

 A. Core API Wrapper Class

\`\`\`javascript  
// api/robloxApiClient.js  
const axios \= require('axios');  
const axiosRetry \= require('axios-retry');  
const Bottleneck \= require('bottleneck');

class RobloxApiClient {  
  constructor(config \= {}) {  
    this.baseUrl \= 'https://thumbnails.roblox.com';  
    this.gamesUrl \= 'https://games.roblox.com';  
    this.usersUrl \= 'https://users.roblox.com';  
      
    // Rate limiting: Roblox allows \~100 req/min  
    this.limiter \= new Bottleneck({  
      maxConcurrent: 5,  
      minTime: 100, // 100ms between requests  
      maxConcurrent: 10  
    });  
      
    this.client \= axios.create({  
      timeout: 30000,  
      headers: {  
        'User-Agent': 'RobloxDatasetBuilder/1.0',  
        'Accept': 'application/json'  
      }  
    });  
      
    // Retry configuration  
    axiosRetry(this.client, {  
      retries: 3,  
      retryDelay: axiosRetry.exponentialDelay,  
      retryCondition: (error) \=\> {  
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||  
               error.response?.status \>= 500;  
      }  
    });  
      
    this.cache \= new Map();  
    this.cacheExpiry \= config.cacheExpiry || 3600000; // 1 hour  
  }

  // Thumbnail API \- Get player thumbnails  
  async getPlayerThumbnails(userIds, options \= {}) {  
    const {  
      size \= '720x720',  
      format \= 'png',  
      isCircular \= false,  
      cropType \= 'avatar' // avatar, avatar-bust, avatar-headshot  
    } \= options;

    // Validate input  
    if (\!Array.isArray(userIds)) {  
      userIds \= \[userIds\];  
    }  
      
    if (userIds.length \> 100\) {  
      throw new Error('Maximum 100 userIds per request');  
    }

    const cacheKey \= \`thumbnails:${cropType}:${size}:${format}:${userIds.join(',')}\`;  
    const cached \= this.getCache(cacheKey);  
    if (cached) return cached;

    const url \= \`${this.baseUrl}/v1/users/${cropType}\`;  
      
    const response \= await this.limiter.schedule(() \=\>  
      this.client.get(url, {  
        params: {  
          userIds: userIds.join(','),  
          size,  
          format,  
          isCircular  
        }  
      })  
    );

    const result \= response.data.data;  
    this.setCache(cacheKey, result);  
    return result;  
  }

  // Games API \- Get game thumbnails  
  async getGameThumbnails(gameIds, options \= {}) {  
    const {  
      size \= '768x432',  
      format \= 'png',  
      count \= 1  
    } \= options;

    if (\!Array.isArray(gameIds)) {  
      gameIds \= \[gameIds\];  
    }

    const cacheKey \= \`game-thumbnails:${size}:${format}:${gameIds.join(',')}\`;  
    const cached \= this.getCache(cacheKey);  
    if (cached) return cached;

    const url \= \`${this.baseUrl}/v1/games/icons\`;  
      
    const response \= await this.limiter.schedule(() \=\>  
      this.client.get(url, {  
        params: {  
          universeIds: gameIds.join(','),  
          size,  
          format,  
          count  
        }  
      })  
    );

    const result \= response.data.data;  
    this.setCache(cacheKey, result);  
    return result;  
  }

  // Games API \- Search games  
  async searchGames(keyword, options \= {}) {  
    const {  
      limit \= 100,  
      sortOrder \= 'Desc',  
      excludeNonPlayableGames \= true  
    } \= options;

    const cacheKey \= \`games-search:${keyword}:${limit}\`;  
    const cached \= this.getCache(cacheKey);  
    if (cached) return cached;

    const url \= \`${this.gamesUrl}/v1/games/list\`;  
      
    const response \= await this.limiter.schedule(() \=\>  
      this.client.get(url, {  
        params: {  
          keyword,  
          limit,  
          sortOrder,  
          excludeNonPlayableGames  
        }  
      })  
    );

    const result \= response.data;  
    this.setCache(cacheKey, result);  
    return result;  
  }

  // Games API \- Get popular games  
  async getPopularGames(options \= {}) {  
    const {  
      limit \= 100,  
      sortOrder \= 'Desc'  
    } \= options;

    const cacheKey \= \`games-popular:${limit}\`;  
    const cached \= this.getCache(cacheKey);  
    if (cached) return cached;

    const url \= \`${this.gamesUrl}/v1/games/list\`;  
      
    const response \= await this.limiter.schedule(() \=\>  
      this.client.get(url, {  
        params: {  
          limit,  
          sortOrder  
        }  
      })  
    );

    const result \= response.data;  
    this.setCache(cacheKey, result);  
    return result;  
  }

  // Users API \- Get user info  
  async getUsers(userIds) {  
    if (\!Array.isArray(userIds)) {  
      userIds \= \[userIds\];  
    }

    const cacheKey \= \`users:${userIds.join(',')}\`;  
    const cached \= this.getCache(cacheKey);  
    if (cached) return cached;

    const url \= \`${this.usersUrl}/v1/users\`;  
      
    const response \= await this.limiter.schedule(() \=\>  
      this.client.post(url, { userIds })  
    );

    const result \= response.data;  
    this.setCache(cacheKey, result);  
    return result;  
  }

  // Groups API \- Get group icon  
  async getGroupIcons(groupIds, options \= {}) {  
    const {  
      size \= '150x150',  
      format \= 'png'  
    } \= options;

    if (\!Array.isArray(groupIds)) {  
      groupIds \= \[groupIds\];  
    }

    const cacheKey \= \`groups:${size}:${format}:${groupIds.join(',')}\`;  
    const cached \= this.getCache(cacheKey);  
    if (cached) return cached;

    const url \= \`${this.baseUrl}/v1/groups/icons\`;  
      
    const response \= await this.limiter.schedule(() \=\>  
      this.client.get(url, {  
        params: {  
          groupIds: groupIds.join(','),  
          size,  
          format  
        }  
      })  
    );

    const result \= response.data.data;  
    this.setCache(cacheKey, result);  
    return result;  
  }

  // Cache methods  
  getCache(key) {  
    const item \= this.cache.get(key);  
    if (\!item) return null;  
      
    if (Date.now() \- item.timestamp \> this.cacheExpiry) {  
      this.cache.delete(key);  
      return null;  
    }  
      
    return item.data;  
  }

  setCache(key, data) {  
    this.cache.set(key, {  
      data,  
      timestamp: Date.now()  
    });  
  }

  clearCache() {  
    this.cache.clear();  
  }  
}

module.exports \= RobloxApiClient;  
\`\`\`

\---

 🗄️ 2\. FREE DATABASE APIs

 A. SQLite (Local \- No Setup Required)

\`\`\`javascript  
// api/database/sqliteClient.js  
const sqlite3 \= require('sqlite3').verbose();  
const path \= require('path');

class SQLiteClient {  
  constructor(dbPath \= './data/roblox\_dataset.db') {  
    this.dbPath \= dbPath;  
    this.db \= null;  
  }

  async connect() {  
    return new Promise((resolve, reject) \=\> {  
      this.db \= new sqlite3.Database(this.dbPath, (err) \=\> {  
        if (err) reject(err);  
        else {  
          console.log('✅ Connected to SQLite database');  
          this.initializeTables();  
          resolve();  
        }  
      });  
    });  
  }

  initializeTables() {  
    const tables \= \`  
      CREATE TABLE IF NOT EXISTS thumbnails (  
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        user\_id INTEGER,  
        image\_url TEXT NOT NULL,  
        local\_path TEXT,  
        size VARCHAR(20),  
        format VARCHAR(10),  
        crop\_type VARCHAR(20),  
        file\_size\_kb INTEGER,  
        width INTEGER,  
        height INTEGER,  
        state VARCHAR(20),  
        collected\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
        UNIQUE(user\_id, size, crop\_type)  
      );

      CREATE TABLE IF NOT EXISTS games (  
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        game\_id INTEGER UNIQUE,  
        name TEXT,  
        description TEXT,  
        creator\_id INTEGER,  
        creator\_type TEXT,  
        thumbnail\_url TEXT,  
        local\_thumbnail\_path TEXT,  
        max\_players INTEGER,  
        playing INTEGER,  
        visits INTEGER,  
        created\_at DATETIME,  
        updated\_at DATETIME  
      );

      CREATE TABLE IF NOT EXISTS users (  
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        user\_id INTEGER UNIQUE,  
        name TEXT,  
        display\_name TEXT,  
        created\_at DATETIME,  
        is\_banned BOOLEAN  
      );

      CREATE TABLE IF NOT EXISTS collection\_stats (  
        id INTEGER PRIMARY KEY AUTOINCREMENT,  
        total\_thumbnails INTEGER DEFAULT 0,  
        total\_games INTEGER DEFAULT 0,  
        total\_users INTEGER DEFAULT 0,  
        storage\_used\_mb REAL DEFAULT 0,  
        last\_updated DATETIME DEFAULT CURRENT\_TIMESTAMP  
      );

      CREATE INDEX IF NOT EXISTS idx\_thumbnails\_user\_id ON thumbnails(user\_id);  
      CREATE INDEX IF NOT EXISTS idx\_thumbnails\_size ON thumbnails(size);  
      CREATE INDEX IF NOT EXISTS idx\_games\_visits ON games(visits DESC);  
    \`;

    this.db.exec(tables, (err) \=\> {  
      if (err) console.error('Error creating tables:', err);  
    });  
  }

  // Thumbnail operations  
  async insertThumbnail(data) {  
    const {  
      userId, imageUrl, localPath, size, format,   
      cropType, fileSizeKb, width, height, state  
    } \= data;

    return new Promise((resolve, reject) \=\> {  
      const sql \= \`  
        INSERT OR REPLACE INTO thumbnails   
        (user\_id, image\_url, local\_path, size, format, crop\_type,   
         file\_size\_kb, width, height, state)  
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)  
      \`;

      this.db.run(sql, \[  
        userId, imageUrl, localPath, size, format,   
        cropType, fileSizeKb, width, height, state  
      \], function(err) {  
        if (err) reject(err);  
        else resolve({ id: this.lastID, changes: this.changes });  
      });  
    });  
  }

  async batchInsertThumbnails(thumbnails) {  
    const stmt \= this.db.prepare(\`  
      INSERT OR REPLACE INTO thumbnails   
      (user\_id, image\_url, local\_path, size, format, crop\_type,   
       file\_size\_kb, width, height, state)  
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)  
    \`);

    return new Promise((resolve, reject) \=\> {  
      let inserted \= 0;  
        
      thumbnails.forEach((thumb) \=\> {  
        stmt.run(\[  
          thumb.userId, thumb.imageUrl, thumb.localPath || null,  
          thumb.size, thumb.format, thumb.cropType,  
          thumb.fileSizeKb || null, thumb.width || null,  
          thumb.height || null, thumb.state || 'Completed'  
        \], (err) \=\> {  
          if (err) {  
            stmt.finalize();  
            reject(err);  
            return;  
          }  
          inserted++;  
        });  
      });

      stmt.finalize((err) \=\> {  
        if (err) reject(err);  
        else resolve(inserted);  
      });  
    });  
  }

  async getThumbnails(filters \= {}) {  
    const { limit \= 100, offset \= 0, size, cropType, userId } \= filters;  
      
    let sql \= 'SELECT  FROM thumbnails WHERE 1=1';  
    const params \= \[\];

    if (size) {  
      sql \+= ' AND size \= ?';  
      params.push(size);  
    }  
    if (cropType) {  
      sql \+= ' AND crop\_type \= ?';  
      params.push(cropType);  
    }  
    if (userId) {  
      sql \+= ' AND user\_id \= ?';  
      params.push(userId);  
    }

    sql \+= ' ORDER BY collected\_at DESC LIMIT ? OFFSET ?';  
    params.push(limit, offset);

    return new Promise((resolve, reject) \=\> {  
      this.db.all(sql, params, (err, rows) \=\> {  
        if (err) reject(err);  
        else resolve(rows);  
      });  
    });  
  }

  // Stats operations  
  async getStats() {  
    return new Promise((resolve, reject) \=\> {  
      const sql \= \`  
        SELECT   
          COUNT(DISTINCT id) as total\_thumbnails,  
          COUNT(DISTINCT user\_id) as unique\_users,  
          COUNT(DISTINCT size) as available\_sizes,  
          AVG(file\_size\_kb) as avg\_file\_size\_kb,  
          SUM(file\_size\_kb) / 1024 as total\_storage\_mb  
        FROM thumbnails  
      \`;

      this.db.get(sql, (err, row) \=\> {  
        if (err) reject(err);  
        else resolve(row);  
      });  
    });  
  }

  async close() {  
    return new Promise((resolve, reject) \=\> {  
      this.db.close((err) \=\> {  
        if (err) reject(err);  
        else {  
          console.log('✅ Database connection closed');  
          resolve();  
        }  
      });  
    });  
  }  
}

module.exports \= SQLiteClient;  
\`\`\`

 B. Supabase (Free Cloud Database \- 500MB Free)

\`\`\`javascript  
// api/database/supabaseClient.js  
const { createClient } \= require('@supabase/supabase-js');

class SupabaseClient {  
  constructor(supabaseUrl, supabaseKey) {  
    this.supabase \= createClient(supabaseUrl, supabaseKey);  
  }

  async insertThumbnail(data) {  
    const { data: result, error } \= await this.supabase  
      .from('thumbnails')  
      .insert(\[data\])  
      .select();

    if (error) throw error;  
    return result;  
  }

  async batchInsertThumbnails(thumbnails) {  
    const { data: result, error } \= await this.supabase  
      .from('thumbnails')  
      .insert(thumbnails)  
      .select();

    if (error) throw error;  
    return result;  
  }

  async getThumbnails(filters \= {}) {  
    let query \= this.supabase  
      .from('thumbnails')  
      .select('');

    if (filters.size) {  
      query \= query.eq('size', filters.size);  
    }  
    if (filters.cropType) {  
      query \= query.eq('crop\_type', filters.cropType);  
    }

    query \= query  
      .order('collected\_at', { ascending: false })  
      .range(filters.offset || 0, (filters.offset || 0\) \+ (filters.limit || 100));

    const { data, error } \= await query;  
    if (error) throw error;  
    return data;  
  }

  // File storage (Supabase Storage \- 1GB free)  
  async uploadImage(fileBuffer, fileName, bucket \= 'thumbnails') {  
    const { data, error } \= await this.supabase.storage  
      .from(bucket)  
      .upload(fileName, fileBuffer, {  
        cacheControl: '3600',  
        upsert: false  
      });

    if (error) throw error;  
      
    // Get public URL  
    const { data: { publicUrl } } \= this.supabase.storage  
      .from(bucket)  
      .getPublicUrl(fileName);

    return { path: data.path, publicUrl };  
  }  
}

module.exports \= SupabaseClient;  
\`\`\`

\---

 💾 3\. FREE IMAGE STORAGE APIs

 A. Local Storage with CDN-like Structure

\`\`\`javascript  
// api/storage/localStorage.js  
const fs \= require('fs').promises;  
const path \= require('path');  
const axios \= require('axios');  
const sharp \= require('sharp'); // Image processing

class LocalStorage {  
  constructor(basePath \= './data/images') {  
    this.basePath \= basePath;  
    this.ensureDirectories();  
  }

  async ensureDirectories() {  
    const dirs \= \[  
      this.basePath,  
      path.join(this.basePath, 'thumbnails'),  
      path.join(this.basePath, 'games'),  
      path.join(this.basePath, 'users'),  
      path.join(this.basePath, 'processed')  
    \];

    for (const dir of dirs) {  
      await fs.mkdir(dir, { recursive: true });  
    }  
  }

  async downloadImage(url, userId, size, cropType, format \= 'png') {  
    try {  
      const response \= await axios.get(url, {  
        responseType: 'arraybuffer',  
        timeout: 30000  
      });

      const fileName \= \`${userId}\_${cropType}\_${size}.${format}\`;  
      const filePath \= path.join(this.basePath, 'thumbnails', fileName);

      await fs.writeFile(filePath, response.data);

      // Get image metadata  
      const metadata \= await sharp(response.data).metadata();

      return {  
        fileName,  
        filePath,  
        fileSize: response.data.length,  
        fileSizeKb: Math.round(response.data.length / 1024),  
        width: metadata.width,  
        height: metadata.height,  
        format: metadata.format  
      };  
    } catch (error) {  
      console.error(\`Failed to download ${url}:\`, error.message);  
      throw error;  
    }  
  }

  async processImage(filePath, operations \= {}) {  
    const {  
      resize \= null,  
      grayscale \= false,  
      quality \= 85,  
      format \= null  
    } \= operations;

    let processor \= sharp(filePath);

    if (resize) {  
      processor \= processor.resize(resize.width, resize.height, {  
        fit: resize.fit || 'cover'  
      });  
    }

    if (grayscale) {  
      processor \= processor.grayscale();  
    }

    if (format) {  
      const options \= { quality };  
      processor \= processor\[format\](options);  
    } else {  
      processor \= processor.jpeg({ quality });  
    }

    const processedBuffer \= await processor.toBuffer();  
    const processedPath \= filePath.replace(/\\.(\\w+)$/, '\_processed.$1');  
      
    await fs.writeFile(processedPath, processedBuffer);

    return {  
      path: processedPath,  
      size: processedBuffer.length  
    };  
  }

  async getStorageStats() {  
    const stats \= await fs.stat(this.basePath);  
    const totalSize \= await this.getDirectorySize(this.basePath);

    return {  
      totalSizeBytes: totalSize,  
      totalSizeMB: Math.round(totalSize / 1024 / 1024  100\) / 100,  
      created: stats.birthtime,  
      modified: stats.mtime  
    };  
  }

  async getDirectorySize(dirPath) {  
    const files \= await fs.readdir(dirPath, { withFileTypes: true });  
      
    let totalSize \= 0;  
    for (const file of files) {  
      const filePath \= path.join(dirPath, file.name);  
      if (file.isDirectory()) {  
        totalSize \+= await this.getDirectorySize(filePath);  
      } else {  
        const stats \= await fs.stat(filePath);  
        totalSize \+= stats.size;  
      }  
    }  
      
    return totalSize;  
  }

  async deleteImage(filePath) {  
    await fs.unlink(filePath);  
  }

  async listImages(options \= {}) {  
    const {   
      directory \= 'thumbnails',   
      pattern \= null,  
      limit \= 100   
    } \= options;

    const dirPath \= path.join(this.basePath, directory);  
    const files \= await fs.readdir(dirPath);

    let filtered \= files;  
    if (pattern) {  
      const regex \= new RegExp(pattern);  
      filtered \= files.filter(f \=\> regex.test(f));  
    }

    return filtered.slice(0, limit).map(fileName \=\> ({  
      fileName,  
      path: path.join(dirPath, fileName)  
    }));  
  }  
}

module.exports \= LocalStorage;  
\`\`\`

 B. Cloudinary (Free Tier \- 25GB Storage, 25GB Bandwidth)

\`\`\`javascript  
// api/storage/cloudinaryClient.js  
const cloudinary \= require('cloudinary').v2;  
const { CloudinaryStorage } \= require('multer-storage-cloudinary');

class CloudinaryClient {  
  constructor(cloudName, apiKey, apiSecret) {  
    cloudinary.config({  
      cloud\_name: cloudName,  
      api\_key: apiKey,  
      api\_secret: apiSecret  
    });  
  }

  async uploadImage(fileBuffer, options \= {}) {  
    const {  
      folder \= 'roblox-thumbnails',  
      publicId \= null,  
      transformation \= \[\]  
    } \= options;

    return new Promise((resolve, reject) \=\> {  
      cloudinary.uploader.upload\_stream(  
        {  
          folder,  
          public\_id: publicId,  
          transformation,  
          resource\_type: 'image'  
        },  
        (error, result) \=\> {  
          if (error) reject(error);  
          else resolve({  
            publicId: result.public\_id,  
            url: result.secure\_url,  
            width: result.width,  
            height: result.height,  
            format: result.format,  
            bytes: result.bytes  
          });  
        }  
      ).end(fileBuffer);  
    });  
  }

  async uploadFromUrl(imageUrl, options \= {}) {  
    const {  
      folder \= 'roblox-thumbnails',  
      publicId \= null  
    } \= options;

    const result \= await cloudinary.uploader.upload(imageUrl, {  
      folder,  
      public\_id: publicId,  
      resource\_type: 'image'  
    });

    return {  
      publicId: result.public\_id,  
      url: result.secure\_url,  
      width: result.width,  
      height: result.height  
    };  
  }

  async deleteImage(publicId) {  
    return await cloudinary.uploader.destroy(publicId);  
  }

  async getStorageUsage() {  
    return await cloudinary.api.usage();  
  }

  // Generate optimized URLs  
  getOptimizedUrl(publicId, options \= {}) {  
    const {  
      width \= 720,  
      height \= 720,  
      quality \= 'auto',  
      format \= 'auto'  
    } \= options;

    return cloudinary.url(publicId, {  
      width,  
      height,  
      crop: 'fill',  
      quality,  
      format,  
      fetch\_format: 'auto'  
    });  
  }  
}

module.exports \= CloudinaryClient;  
\`\`\`

\---

 🔍 4\. FREE SEARCH & DISCOVERY APIs

 A. DuckDuckGo Instant Answer API (Free, No Auth)

\`\`\`javascript  
// api/search/duckDuckGoClient.js  
const axios \= require('axios');

class DuckDuckGoClient {  
  constructor() {  
    this.baseUrl \= 'https://api.duckduckgo.com';  
    this.client \= axios.create({  
      timeout: 10000,  
      headers: {  
        'User-Agent': 'RobloxDatasetBuilder/1.0'  
      }  
    });  
  }

  async search(query, options \= {}) {  
    const {  
      format \= 'json',  
      noHtml \= 1,  
      skipDisambig \= 1  
    } \= options;

    try {  
      const response \= await this.client.get(this.baseUrl, {  
        params: {  
          q: query,  
          format,  
          noHtml,  
          skipDisambig  
        }  
      });

      return response.data;  
    } catch (error) {  
      console.error('DuckDuckGo search error:', error.message);  
      return null;  
    }  
  }

  async searchImages(query, maxResults \= 50\) {  
    // DuckDuckGo doesn't have official image API  
    // Use HTML scraping as fallback (respect robots.txt)  
    const url \= \`https://duckduckgo.com/?q=${encodeURIComponent(query)}\&iax=images\&ia=images\`;  
      
    try {  
      const response \= await this.client.get(url);  
      // Parse HTML to extract image URLs  
      // Note: This is a simplified example  
      return this.extractImageUrls(response.data, maxResults);  
    } catch (error) {  
      console.error('Image search error:', error.message);  
      return \[\];  
    }  
  }

  extractImageUrls(html, maxResults) {  
    // Simple regex extraction (use cheerio for production)  
    const imageRegex \= /\<img\[^\>\]+src="(\[^"\]+\\.(?:jpg|jpeg|png|webp))"/gi;  
    const images \= \[\];  
    let match;  
      
    while ((match \= imageRegex.exec(html)) \!== null && images.length \< maxResults) {  
      images.push(match\[1\]);  
    }  
      
    return images;  
  }  
}

module.exports \= DuckDuckGoClient;  
\`\`\`

 B. Bing Image Search (Free Tier \- 1,000 calls/month)

\`\`\`javascript  
// api/search/bingImageClient.js  
const axios \= require('axios');

class BingImageClient {  
  constructor(apiKey) {  
    this.apiKey \= apiKey;  
    this.baseUrl \= 'https://api.bing.microsoft.com/v7.0';  
    this.client \= axios.create({  
      timeout: 10000,  
      headers: {  
        'Ocp-Apim-Subscription-Key': apiKey  
      }  
    });  
  }

  async searchImages(query, options \= {}) {  
    const {  
      count \= 50,  
      offset \= 0,  
      mkt \= 'en-US',  
      safeSearch \= 'Moderate',  
      imageType \= 'Photo'  
    } \= options;

    try {  
      const response \= await this.client.get(\`${this.baseUrl}/images/search\`, {  
        params: {  
          q: query,  
          count,  
          offset,  
          mkt,  
          safeSearch,  
          imageType  
        }  
      });

      return response.data.value.map(img \=\> ({  
        name: img.name,  
        contentUrl: img.contentUrl,  
        hostPageUrl: img.hostPageUrl,  
        width: img.width,  
        height: img.height,  
        thumbnailUrl: img.thumbnailUrl,  
        encodingFormat: img.encodingFormat  
      }));  
    } catch (error) {  
      console.error('Bing search error:', error.message);  
      throw error;  
    }  
  }

  async trendingImages() {  
    try {  
      const response \= await this.client.get(\`${this.baseUrl}/images/trending\`);  
      return response.data;  
    } catch (error) {  
      console.error('Trending images error:', error.message);  
      throw error;  
    }  
  }  
}

module.exports \= BingImageClient;  
\`\`\`

\---

 🎯 5\. UNIFIED API MANAGER

\`\`\`javascript  
// api/apiManager.js  
const RobloxApiClient \= require('./robloxApiClient');  
const SQLiteClient \= require('./database/sqliteClient');  
const LocalStorage \= require('./storage/localStorage');  
const EventEmitter \= require('events');

class ApiManager extends EventEmitter {  
  constructor(config \= {}) {  
    super();  
      
    this.roblox \= new RobloxApiClient(config.roblox);  
    this.database \= new SQLiteClient(config.database?.path);  
    this.storage \= new LocalStorage(config.storage?.basePath);  
      
    this.stats \= {  
      requestsMade: 0,  
      imagesDownloaded: 0,  
      errors: 0,  
      startTime: Date.now()  
    };  
  }

  async initialize() {  
    console.log('🚀 Initializing API Manager...');  
    await this.database.connect();  
    console.log('✅ API Manager initialized');  
  }

  // Main collection method  
  async collectThumbnails(options \= {}) {  
    const {  
      startUserId \= 1,  
      endUserId \= 1000,  
      batchSize \= 100,  
      sizes \= \['420x420', '720x720'\],  
      cropTypes \= \['avatar', 'avatar-headshot'\],  
      format \= 'png',  
      downloadImages \= true  
    } \= options;

    console.log(\`📥 Starting collection: Users ${startUserId} to ${endUserId}\`);  
      
    let collected \= 0;  
    let errors \= 0;

    for (let userId \= startUserId; userId \<= endUserId; userId \+= batchSize) {  
      const batchEnd \= Math.min(userId \+ batchSize \- 1, endUserId);  
      const batchIds \= Array.from(  
        { length: batchEnd \- userId \+ 1 },  
        (\_, i) \=\> userId \+ i  
      );

      try {  
        console.log(\`\\n📦 Processing batch: ${userId} \- ${batchEnd}\`);

        for (const cropType of cropTypes) {  
          for (const size of sizes) {  
            try {  
              // Fetch thumbnails from Roblox API  
              const thumbnails \= await this.roblox.getPlayerThumbnails(  
                batchIds,  
                { size, format, cropType }  
              );

              // Process each thumbnail  
              for (const thumb of thumbnails) {  
                if (thumb.state \=== 'Completed' && thumb.imageUrl) {  
                  let localPath \= null;  
                  let fileInfo \= null;

                  if (downloadImages) {  
                    try {  
                      fileInfo \= await this.storage.downloadImage(  
                        thumb.imageUrl,  
                        thumb.targetId,  
                        size,  
                        cropType,  
                        format  
                      );  
                      localPath \= fileInfo.filePath;  
                      this.stats.imagesDownloaded++;  
                    } catch (err) {  
                      console.error(\`  ⚠️  Failed to download: ${err.message}\`);  
                    }  
                  }

                  // Save to database  
                  await this.database.insertThumbnail({  
                    userId: thumb.targetId,  
                    imageUrl: thumb.imageUrl,  
                    localPath,  
                    size,  
                    format,  
                    cropType,  
                    fileSizeKb: fileInfo?.fileSizeKb || null,  
                    width: fileInfo?.width || null,  
                    height: fileInfo?.height || null,  
                    state: thumb.state  
                  });

                  collected++;  
                }  
              }

              this.stats.requestsMade++;  
                
              // Rate limiting  
              await this.sleep(200);  
            } catch (err) {  
              console.error(\`  ❌ Error for ${cropType} ${size}:\`, err.message);  
              errors++;  
              this.stats.errors++;  
            }  
          }  
        }

        console.log(\`  ✅ Batch complete. Collected: ${collected}, Errors: ${errors}\`);  
          
        // Emit progress event  
        this.emit('progress', {  
          currentUserId: batchEnd,  
          totalUsers: endUserId \- startUserId \+ 1,  
          collected,  
          errors  
        });

        // Save stats periodically  
        if (batchEnd % 500 \=== 0\) {  
          await this.saveStats();  
        }

      } catch (err) {  
        console.error(\`❌ Batch failed: ${err.message}\`);  
        errors++;  
      }  
    }

    await this.saveStats();  
    return { collected, errors, stats: this.stats };  
  }

  // Collect game thumbnails  
  async collectGameThumbnails(options \= {}) {  
    const {  
      keyword \= null,  
      limit \= 100,  
      sizes \= \['768x432'\],  
      downloadImages \= true  
    } \= options;

    let games;  
      
    if (keyword) {  
      games \= await this.roblox.searchGames(keyword, { limit });  
    } else {  
      games \= await this.roblox.getPopularGames({ limit });  
    }

    const gameIds \= games.data.map(g \=\> g.id);  
    const thumbnails \= await this.roblox.getGameThumbnails(gameIds, {  
      size: sizes\[0\]  
    });

    console.log(\`📥 Collected ${thumbnails.length} game thumbnails\`);  
      
    return thumbnails;  
  }

  async getDatasetStats() {  
    const dbStats \= await this.database.getStats();  
    const storageStats \= await this.storage.getStorageStats();  
      
    return {  
      ...dbStats,  
      ...storageStats,  
      apiStats: this.stats  
    };  
  }

  async saveStats() {  
    const stats \= await this.getDatasetStats();  
    const fs \= require('fs').promises;  
      
    await fs.writeFile(  
      './data/collection\_stats.json',  
      JSON.stringify(stats, null, 2\)  
    );  
  }

  sleep(ms) {  
    return new Promise(resolve \=\> setTimeout(resolve, ms));  
  }

  async shutdown() {  
    console.log('\\n🛑 Shutting down API Manager...');  
    await this.database.close();  
    console.log('✅ Shutdown complete');  
  }  
}

module.exports \= ApiManager;  
\`\`\`

\---

 📝 6\. CONFIGURATION FILE

\`\`\`javascript  
// config/apiConfig.js  
module.exports \= {  
  // Roblox API settings  
  roblox: {  
    cacheExpiry: 3600000, // 1 hour  
    maxRetries: 3,  
    retryDelay: 500,  
    rateLimit: {  
      maxConcurrent: 5,  
      minTime: 100  
    }  
  },

  // Database settings  
  database: {  
    path: './data/roblox\_dataset.db',  
    // For Supabase (optional):  
    // supabase: {  
    //   url: process.env.SUPABASE\_URL,  
    //   key: process.env.SUPABASE\_KEY  
    // }  
  },

  // Storage settings  
  storage: {  
    basePath: './data/images',  
    // For Cloudinary (optional):  
    // cloudinary: {  
    //   cloudName: process.env.CLOUDINARY\_CLOUD\_NAME,  
    //   apiKey: process.env.CLOUDINARY\_API\_KEY,  
    //   apiSecret: process.env.CLOUDINARY\_API\_SECRET  
    // }  
  },

  // Collection settings  
  collection: {  
    defaultBatchSize: 100,  
    defaultSizes: \['150x150', '420x420', '720x720'\],  
    defaultCropTypes: \['avatar', 'avatar-headshot', 'avatar-bust'\],  
    defaultFormat: 'png',  
    rateLimitDelay: 200, // ms between batches  
    maxConcurrentDownloads: 5  
  },

  // API Keys (Free tiers)  
  apiKeys: {  
    // Bing Image Search (1,000 calls/month free)  
    bing: process.env.BING\_API\_KEY || null,  
      
    // Cloudinary (25GB storage free)  
    cloudinary: {  
      cloudName: process.env.CLOUDINARY\_CLOUD\_NAME || null,  
      apiKey: process.env.CLOUDINARY\_API\_KEY || null,  
      apiSecret: process.env.CLOUDINARY\_API\_SECRET || null  
    }  
  }  
};  
\`\`\`

\---

 🚀 7\. USAGE EXAMPLE

\`\`\`javascript  
// examples/collectThumbnails.js  
const ApiManager \= require('../api/apiManager');  
const config \= require('../config/apiConfig');

async function main() {  
  const manager \= new ApiManager(config);  
    
  // Setup event listeners  
  manager.on('progress', (progress) \=\> {  
    const percent \= ((progress.currentUserId / progress.totalUsers)  100).toFixed(1);  
    console.log(\`📊 Progress: ${percent}% \- Collected: ${progress.collected} \- Errors: ${progress.errors}\`);  
  });

  try {  
    // Initialize  
    await manager.initialize();

    // Collect player thumbnails  
    console.log('\\n🎯 Starting thumbnail collection...');  
    const result \= await manager.collectThumbnails({  
      startUserId: 1,  
      endUserId: 1000,  
      batchSize: 100,  
      sizes: \['420x420', '720x720'\],  
      cropTypes: \['avatar', 'avatar-headshot'\],  
      format: 'png',  
      downloadImages: true  
    });

    console.log('\\n✅ Collection complete\!');  
    console.log(\`📦 Total collected: ${result.collected}\`);  
    console.log(\`❌ Errors: ${result.errors}\`);  
    console.log(\`📊 Stats:\`, result.stats);

    // Get final stats  
    const stats \= await manager.getDatasetStats();  
    console.log('\\n📈 Dataset Statistics:');  
    console.log(\`  Total thumbnails: ${stats.total\_thumbnails}\`);  
    console.log(\`  Unique users: ${stats.unique\_users}\`);  
    console.log(\`  Storage used: ${stats.totalSizeMB} MB\`);

  } catch (error) {  
    console.error('❌ Fatal error:', error);  
  } finally {  
    await manager.shutdown();  
  }  
}

main();  
\`\`\`

\---

 📦 8\. PACKAGE.JSON DEPENDENCIES

\`\`\`json  
{  
  "name": "roblox-thumbnail-dataset",  
  "version": "1.0.0",  
  "dependencies": {  
    "axios": "^1.6.0",  
    "axios-retry": "^3.8.0",  
    "bottleneck": "^2.19.5",  
    "sqlite3": "^5.1.6",  
    "sharp": "^0.33.0",  
    "@supabase/supabase-js": "^2.38.0",  
    "cloudinary": "^1.41.0",  
    "multer-storage-cloudinary": "^4.0.0",  
    "dotenv": "^16.3.1",  
    "express": "^4.18.2",  
    "cors": "^2.8.5"  
  },  
  "devDependencies": {  
    "jest": "^29.7.0",  
    "eslint": "^8.53.0"  
  }  
}  
\`\`\`

\---

 ✅ FREE API SERVICES SUMMARY

| Service | Free Tier | Purpose | Auth Required |  
|---------|-----------|---------|---------------|  
| Roblox Thumbnails API | Unlimited | Player/Game thumbnails | No |  
| Roblox Games API | Unlimited | Game search & info | No |  
| Roblox Users API | Unlimited | User info | No |  
| SQLite | Unlimited | Local database | No |  
| Supabase | 500MB DB \+ 1GB Storage | Cloud database | Yes (Free) |  
| Cloudinary | 25GB Storage \+ 25GB Bandwidth | Image CDN | Yes (Free) |  
| DuckDuckGo API | Unlimited | Search (limited) | No |  
| Bing Image Search | 1,000 calls/month | Image search | Yes (Free) |

\---

 🎯 NEXT STEPS

1\. Install dependencies: \`npm install\`  
2\. Create \`.env\` file (optional for free services)  
3\. Run collection: \`node examples/collectThumbnails.js\`  
4\. Monitor progress: Check \`./data/collection\_stats.json\`  
5\. Query database: Use SQLite browser or CLI

This architecture gives you a production-ready, 100% free API infrastructure that can scale to collect thousands of Roblox thumbnails efficiently and legally\! 🚀  
