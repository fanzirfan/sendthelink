<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# bikin dokumentasi ini [API Documentation - urlscan.io](https://urlscan.io/docs/api/)

Berikut dokumentasi ringkas (siap pakai) untuk **urlscan.io API v1**, berdasarkan halaman “API Documentation - urlscan.io”.

## Gambaran umum

urlscan.io menyediakan API untuk submit URL agar dipindai, lalu mengambil hasil scan setelah selesai, serta melakukan pencarian scan yang sudah ada (mis. berdasarkan domain, IP, ASN, hash, dll.).
Untuk menggunakan API secara penuh, perlu akun dan API key; request tanpa autentikasi hanya mendapat kuota kecil.

## Autentikasi \& visibilitas scan

Semua request API sebaiknya menyertakan API key, dan header yang digunakan adalah `API-Key` (bukan variasi header lain).
urlscan.io punya 3 level visibilitas scan seperti berikut.


| Visibility | Ringkasan |
| :-- | :-- |
| Public | Terlihat di frontpage serta hasil pencarian/info publik. |
| Unlisted | Tidak muncul di pencarian/frontpage publik, tetapi tetap dapat terlihat oleh peneliti/komunitas tertentu di urlscan Pro; cocok untuk submit yang berpotensi mengandung PII/non-publik. |
| Private | Hanya terlihat oleh pemilik (atau pihak yang diberi scan ID). |

## Endpoint utama

**1) Submit scan** — `POST https://urlscan.io/api/v1/scan/` untuk mengirim URL dan opsi scan (mis. `visibility`, `tags`).
Opsi tambahan yang disebutkan mencakup `customagent`, `referer`, `overrideSafety`, dan `country` (kode negara ISO 3166-1 alpha-2).

Contoh payload minimal:

```json
{ "url": "https://example.com/", "visibility": "public" }
```

Respons sukses mengembalikan `uuid` dan URL `api` untuk mengambil hasil; saat scan masih berjalan, endpoint hasil dapat merespons HTTP 404.

**2) Ambil hasil scan** — `GET https://urlscan.io/api/v1/result/{uuid}/` untuk polling sampai status menjadi HTTP 200.
Jika hasil scan dihapus, endpoint hasil dapat mengembalikan HTTP 410.

**3) Screenshot \& DOM snapshot** — dengan UUID yang sama, screenshot PNG dan DOM snapshot bisa diambil via `https://urlscan.io/screenshots/{uuid}.png` dan `https://urlscan.io/dom/{uuid}/` (dan bila tidak tersimpan, bisa 404).

**4) Search** — `GET https://urlscan.io/api/v1/search/` memakai sintaks ElasticSearch query string (parameter utama: `q`, opsional `size`, `search_after`).
Search mendukung pagination via `search_after` menggunakan nilai `sort` dari item terakhir (paling lama) pada batch sebelumnya, dan jumlah akurat di `total` hanya sampai 10.000 (setelah itu `has_more` dapat true).

## Rate limit, error, dan praktik terbaik

Kuota/rate limit dipisah per aksi dan per jendela waktu (menit/jam/hari), dan hanya request sukses (HTTP 200) yang dihitung ke kuota.
Jika melampaui limit, API merespons HTTP 429, dan setiap respons rate-limited menyertakan header seperti `X-Rate-Limit-Remaining`, `X-Rate-Limit-Reset`, dan lainnya untuk dipatuhi.
Praktik terbaik yang ditekankan: jangan mirror/scrape data secara massal, hapus PII atau gunakan *Unlisted*, ikuti redirect 301/302, gunakan exponential backoff + batasi concurrency, dan tangani properti JSON yang kadang bisa tidak ada.

Format dokumentasi ini mau dijadikan README Markdown (untuk Git), dokumen internal (Confluence/Notion), atau OpenAPI/Swagger spec?
<span style="display:none">[^1]</span>

<div align="center">⁂</div>

[^1]: https://urlscan.io/docs/api/

