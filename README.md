# obsidian-to-astro-sync

A Node.js script to sync your [Obsidian](https://obsidian.md/) notes with your [Astro](https://astro.build/) content.

## Assumptions

I adapted this script to my own vault and Astro file structures. Here are the requirements for this to work as-is.

### Astro

- You are using content collections 
- All of your images are being dumped into one folder (e.g. `src/content/assets/`)

### Obsidian

- Each note contains the following frontmatter keys:
  - `title:` The title of the note
  - `publish:` If set to true, it will be copied to Astro
  - `collection:` Which collection this note belongs to
  - `slug:` A chosen slug *without* the collection (i.e. `my-blog-post` not `blog/my-blog-post`

## Instructions

- Download the repo contents
- Rename `.env.template` to `.env` and update the file paths to point to the location of your vault and the images and notes in your Astro site
- Run `npm install`
- Run `npm run start` to start the script

The script does the following in order:

- Reads all of your Obsidian notes recursively
- Filters out the notes that don't have `slug`, `collection`, and `publish: true` defined in their frontmatter
- Copies all the images that are used in the published notes to `src/content/assets`
- Processes and writes notes one-by-one:
  - Converts wikilinks to Markdown links (image wikilinks, too)
    - If the link points to another published note, it is replaced with an anchor link to that note
    - If it points to a private note in your vault, the link syntax (`[[ ]]`) is removed
  - Removes everything under a `## Highlights` heading
  - Writes note to `src/content/{collection}/{slug}.md`
- Watches your vault for changes and additions

## Gratitude

This is a fork from [Rach Smith's version](https://github.com/rachsmithcodes/obsidian-to-astro-sync). I adapted her project to fit my specific vault structure. Huge thank you to her for doing most of the work.
