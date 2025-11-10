=== SimSpace ===
Contributors: simspace
Requires at least: 6.0
Tested up to: 6.6
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Room + simulator planner (React app) embedded via shortcode.

== Description ==

Add the SimSpace planner to any page using the shortcode:

[simspace]

Enable a visible debug banner to confirm the shortcode is rendering:

[simspace debug="1"]

== Installation ==

1. Upload the plugin ZIP via wp-admin → Plugins → Add New → Upload Plugin.
2. Activate the plugin.
3. Insert the shortcode [simspace] on a page or post.

== Notes ==

- Assets are loaded only on pages where the shortcode is present.
- Replace the contents of the `assets/` folder with a Vite build that includes `manifest.json`.


