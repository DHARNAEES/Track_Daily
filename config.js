/* Optional settings. Leave blank to keep Track Daily fully offline (nothing leaves the browser).
   To enable "Cloud backup" under More: create a Supabase project, run supabase/schema.sql,
   then paste the project URL and anon (public) key here. The anon key is safe to publish;
   row-level security restricts every row to its owner. */
window.TD_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
};
