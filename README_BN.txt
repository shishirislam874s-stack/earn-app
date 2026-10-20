Earn App - Vercel এ চালানোর নিয়ম
1) এই zip আনজিপ করে Vercel এ Deploy করুন (GitHub এ আপলোড করে Import অথবা Vercel CLI)।
2) Vercel Project > Storage > Create > Postgres (Neon) > Connect Project, তারপর Redeploy।
   (এটিই একমাত্র ধাপ, Vercel এ নিজস্ব ডাটাবেস থাকে না। টেবিল ও সেটিংস প্রথম রিকোয়েস্টে নিজে তৈরি হবে।)
3) ইউজার: /   |  অ্যাডমিন: /admin/login
অ্যাডমিন ইউজারনেম/পাসওয়ার্ড কোডে ডিফল্ট হিসেবে দেওয়া আছে। পরে বদলাতে Vercel Environment Variables এ
ADMIN_USERNAME, ADMIN_PASSWORD, PUBLIC_SITE_URL দিন।
লোগো বদলাতে public/logos/ এর bkash.svg, nagad.svg, rocket.svg রিপ্লেস করুন।
