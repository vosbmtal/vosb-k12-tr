# vosb.k12.tr — Cloudflare Worker

`vosb.k12.tr` alan adı için Cloudflare Workers üzerinde çalışan reverse proxy.  
Okul web sitesini (`velikoyosb.meb.k12.tr`) kendi alan adımız üzerinden sunar.

## Nasıl Çalışır?

Gelen tüm istekleri `https://velikoyosb.meb.k12.tr` adresine yönlendirir; gerekli CORS başlıklarını ekler ve `host`, `origin`, `referer` gibi başlıkları uygun şekilde düzenler.

## Geliştirme

```bash
npm install
npm run dev        # Yerel geliştirme sunucusu
npm run deploy     # Cloudflare Workers'a deploy
```

## Deployment

Cloudflare hesabı: **Buğra Canata**  
Worker adı: `vosb-k12-tr`  
Canlı URL: [vosb.k12.tr](https://vosb.k12.tr)
