<?php
/**
 * Plugin Name: SimSpace
 * Description: Room + simulator planner (React app) embedded via shortcode.
 * Version: 0.1.0
 * Author: SimSpace
 */

if (!defined('ABSPATH')) exit;

define('SIMSPACE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SIMSPACE_PLUGIN_URL', plugins_url('/', __FILE__));

// Track whether we had to use a fallback (no manifest found)
global $simspace_used_fallback;
$simspace_used_fallback = false;
global $simspace_fallback_entry;
$simspace_fallback_entry = '';
global $simspace_fallback_css_count;
$simspace_fallback_css_count = 0;

/**
 * Locate the Vite entry in manifest.json robustly.
 */
function simspace_manifest_entry($manifest) {
  if (!is_array($manifest)) return null;
  // Prefer any entry with isEntry=true
  foreach ($manifest as $key => $val) {
    if (is_array($val) && !empty($val['isEntry'])) {
      return $val;
    }
  }
  // Fallback to common keys
  if (isset($manifest['index.html'])) return $manifest['index.html'];
  if (isset($manifest['src/main.tsx'])) return $manifest['src/main.tsx'];
  if (isset($manifest['src/main.ts'])) return $manifest['src/main.ts'];
  // Last resort: first element
  foreach ($manifest as $val) {
    if (is_array($val)) return $val;
  }
  return null;
}

/**
 * Fallback: if manifest is missing, attempt to enqueue first matching assets.
 */
function simspace_enqueue_fallback_assets($assets_dir, $assets_url) {
  global $simspace_used_fallback;
  global $simspace_fallback_entry;
  global $simspace_fallback_css_count;
  $simspace_used_fallback = true;
  $css_files = array_merge(
    glob($assets_dir . '*.css') ?: [],
    glob($assets_dir . 'assets/*.css') ?: []
  );
  $simspace_fallback_css_count = is_array($css_files) ? count($css_files) : 0;
  foreach ($css_files as $file) {
    $rel = str_replace($assets_dir, '', $file);
    wp_enqueue_style('simspace-' . md5($rel), $assets_url . $rel, [], null);
  }
  $js_files = array_merge(
    glob($assets_dir . '*.js') ?: [],
    glob($assets_dir . 'assets/*.js') ?: []
  );
  $entry_js = '';
  foreach ($js_files as $f) {
    if (preg_match('~(^|/)index-.*\\.js$~', $f)) { $entry_js = $f; break; }
  }
  if (!$entry_js && !empty($js_files)) {
    $entry_js = $js_files[0];
  }
  if ($entry_js) {
    $rel = str_replace($assets_dir, '', $entry_js);
    $simspace_fallback_entry = $rel;
    wp_enqueue_script('simspace-app', $assets_url . $rel, [], null, true);
    if (function_exists('wp_script_add_data')) {
      wp_script_add_data('simspace-app', 'type', 'module');
    }
  }
}

/**
 * Enqueue built assets (Vite manifest-based).
 */
function simspace_enqueue_assets() {
  $assets_dir = SIMSPACE_PLUGIN_DIR . 'assets/';
  $assets_url = SIMSPACE_PLUGIN_URL . 'assets/';
  $manifest_path = $assets_dir . 'manifest.json';
  if (!file_exists($manifest_path)) {
    // Try fallback scan
    simspace_enqueue_fallback_assets($assets_dir, $assets_url);
    return;
  }

  $manifest = json_decode(file_get_contents($manifest_path), true);
  $entry = simspace_manifest_entry($manifest);
  if (!$entry) {
    simspace_enqueue_fallback_assets($assets_dir, $assets_url);
    return;
  }

  // Optional: enqueue Google Fonts used by the app
  wp_enqueue_style(
    'simspace-fonts',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Condensed:wght@300;700;800;900&display=swap',
    [],
    null
  );

  // CSS files emitted by Vite
  if (!empty($entry['css']) && is_array($entry['css'])) {
    foreach ($entry['css'] as $css) {
      $handle = 'simspace-' . md5($css);
      wp_enqueue_style($handle, $assets_url . $css, ['simspace-fonts'], null);
    }
  }

  // JS entry
  if (!empty($entry['file'])) {
    wp_enqueue_script('simspace-app', $assets_url . $entry['file'], [], null, true);
    // Vite build outputs ESM; ensure <script type="module">
    if (function_exists('wp_script_add_data')) {
      wp_script_add_data('simspace-app', 'type', 'module');
    }
    // Example of passing data to the app if needed later
    wp_localize_script('simspace-app', 'SIMSPACE_BOOT', [
      'restBase' => esc_url_raw(rest_url('simspace/v1/')),
      'nonce'    => wp_create_nonce('wp_rest'),
    ]);
  }
}

/**
 * Shortcode renderer.
 * Usage: [simspace]
 */
function simspace_shortcode($atts = []) {
  $atts = shortcode_atts([
    'debug' => '0',
  ], $atts, 'simspace');

  $debugParam = isset($_GET['simspace_debug']) ? sanitize_text_field($_GET['simspace_debug']) : '0';
  $debug = $atts['debug'] === '1' || strtolower($atts['debug']) === 'true' || $debugParam === '1';

  // Ensure assets are enqueued even when content builders (e.g., Bricks) render
  // the shortcode in contexts where has_shortcode() on post_content won't catch it.
  simspace_enqueue_assets();

  // Optional diagnostics when debug is enabled
  $debugHtml = '';
  if ($debug) {
    global $simspace_used_fallback;
    global $simspace_fallback_entry;
    global $simspace_fallback_css_count;
    $assets_dir = SIMSPACE_PLUGIN_DIR . 'assets/';
    $assets_url = SIMSPACE_PLUGIN_URL . 'assets/';
    $manifest_path = $assets_dir . 'manifest.json';
    $manifest_status = file_exists($manifest_path) ? 'found' : 'missing';
    $entry_file = '';
    $css_count = 0;
    if ($manifest_status === 'found') {
      $manifest = json_decode(@file_get_contents($manifest_path), true);
      $entry = simspace_manifest_entry($manifest);
      if (is_array($entry)) {
        $entry_file = isset($entry['file']) ? $entry['file'] : '';
        $css_count = isset($entry['css']) && is_array($entry['css']) ? count($entry['css']) : 0;
      }
    }
    $debugHtml .= '<div class="simspace-debug-banner" style="margin:12px 0;padding:10px 12px;border:1px solid #ddd;border-radius:6px;background:#f7f7f7;color:#222;font:14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
      . '<strong>SimSpace shortcode active</strong><br>'
      . 'Manifest: <code>' . esc_html($manifest_status) . '</code>'
      . ($entry_file ? ' · Entry: <code>' . esc_html($entry_file) . '</code>' : '')
      . ' · CSS files: <code>' . esc_html((string)$css_count) . '</code>'
      . ' · Fallback: <code>' . ($simspace_used_fallback ? 'yes' : 'no') . '</code>'
      . ($simspace_used_fallback && $simspace_fallback_entry ? ' · Fallback entry: <code>' . esc_html($simspace_fallback_entry) . '</code>' : '')
      . ($simspace_used_fallback ? ' · Fallback CSS count: <code>' . esc_html((string)$simspace_fallback_css_count) . '</code>' : '')
      . '<br>Assets URL: <code>' . esc_url($assets_url) . '</code>'
      . '</div>'
      . '<pre id="simspace-debug-log" style="margin:8px 0;padding:8px 10px;border:1px dashed #bbb;border-radius:6px;background:#fff;color:#111;max-height:240px;overflow:auto;font:12px/1.5 Menlo,Consolas,monospace;"></pre>'
      . '<script>(function(){'
      . 'var logEl=document.getElementById("simspace-debug-log");'
      . 'function w(msg){if(!logEl)return;var t=new Date().toISOString().slice(11,19);logEl.textContent+="["+t+"] "+msg+"\\n";}'
      . 'w("Debug mode ON");'
      . 'w("WP version: ' . esc_js(get_bloginfo('version')) . '");'
      . 'w("Site URL: ' . esc_js(get_site_url()) . '");'
      . 'w("Assets base: ' . esc_js($assets_url) . '");'
      . 'window.addEventListener("error",function(e){w("Error: "+(e.message||"unknown")+" at "+(e.filename||"?")+":"+e.lineno+":"+e.colno);if(e.error&&e.error.stack)w(e.error.stack);});'
      . 'window.addEventListener("unhandledrejection",function(e){var r=e.reason||{};w("UnhandledRejection: "+(r.message||String(r)));if(r.stack)w(r.stack);});'
      . 'document.addEventListener("DOMContentLoaded",function(){'
      . 'var root=document.getElementById("root"); w(root?"#root present":"#root MISSING");'
      . 'if(window.SIMSPACE_BOOT){w("SIMSPACE_BOOT present: "+JSON.stringify(window.SIMSPACE_BOOT));} else {w("SIMSPACE_BOOT missing (ok if not used)");}'
      . '});'
      . '})();</script>';
  }

  // The app expects a div#root (per index.html)
  return '<div class="simspace-container">'.$debugHtml.'<div id="root"></div></div>';
}
add_shortcode('simspace', 'simspace_shortcode');

/**
 * Conditionally enqueue assets on pages that use the shortcode.
 */
function simspace_maybe_enqueue() {
  if (!is_singular()) return;
  global $post;
  if (!$post) return;
  if (has_shortcode($post->post_content, 'simspace')) {
    simspace_enqueue_assets();
  }
}
add_action('wp_enqueue_scripts', 'simspace_maybe_enqueue');

/**
 * Tiny settings/help page to show the shortcode and basic notes.
 */
function simspace_admin_menu() {
  add_options_page(
    'SimSpace',
    'SimSpace',
    'manage_options',
    'simspace',
    'simspace_settings_page'
  );
}
add_action('admin_menu', 'simspace_admin_menu');

function simspace_settings_page() {
  if (!current_user_can('manage_options')) return;
  ?>
  <div class="wrap">
    <h1>SimSpace</h1>
    <p>Add the app to any page or post using this shortcode:</p>
    <p><code>[simspace]</code></p>
    <p>You can upload a new build by replacing files in the plugin's <code>assets/</code> folder. The build must include a <code>manifest.json</code> generated by Vite.</p>
  </div>
  <?php
}


