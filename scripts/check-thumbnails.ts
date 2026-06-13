import { createClient } from "@supabase/supabase-js";
import { config } from "../src/config.js";

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

const sourceUrls = [
  "https://www.instagram.com/p/DZMzfL4jFmI/",
  "https://www.instagram.com/p/DZH0Nmkkrms/",
  "https://www.instagram.com/p/DZFS-DnDWT5/",
];

const { data, error } = await supabase
  .from("articles")
  .select("title, source_url, thumbnail_url")
  .in("source_url", sourceUrls);
if (error) throw new Error(error.message);

for (const row of data ?? []) {
  console.log(`${row.title}\n  ${row.source_url}\n  ${row.thumbnail_url}\n`);
}
