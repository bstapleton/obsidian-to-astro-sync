import { promises as fsp } from "fs";
import chokidar from "chokidar";
import 'dotenv/config'

const config = process.env

/**
 * Notes
 */

let allNotes = {};

async function getNote(fileName) {
  const noteContent = await fsp.readFile(
    config.vaultNotesPath + "/" + fileName,
    "utf-8"
  );

  if (noteContent.indexOf("---") != 0) return null;

  const frontmatterText = noteContent.split("---")[1];
  const frontmatter = frontMatterToObject(frontmatterText);

  if (!frontmatter.slug) return null;
  if (!frontmatter.collection) return null;
  if (!frontmatter.publish) return null;

  return {
    fileName,
    shortTitle: fileName.split("/").pop().split(".md")[0], // "slug" in the vault without .md extension
    vaultTitle: fileName.split(".md")[0], // full path in vault without .md extension
    title: frontmatter.title, // note title
    slug: frontmatter.slug, // defined slug that you want note to live at
    content: noteContent, // note contents
    collection: frontmatter.collection // defined collection that notes goes into
  };
}

function frontMatterToObject(frontmatterText) {
  return frontmatterText.split("\n").reduce((object, line) => {
    const [key, value] = line.split(":");
    if (key && value) {
      // some yaml strings are quoted
      if (value.trim().indexOf('"') == 0) {
        object[key.trim()] = value.trim().slice(1, -1);
      } else {
        object[key.trim()] = value.trim();
      }
    }
    return object;
  }, {});
}

async function readNotes() {
  let noteFileNames = await fsp.readdir(config.vaultNotesPath, { recursive: true });
  noteFileNames = noteFileNames.filter((fileName) => fileName.endsWith(".md"));
  let notes = await Promise.all(
    noteFileNames.map((noteFileName) => getNote(noteFileName))
  );
  // filter out null values
  notes = notes.filter((note) => note);
  for (const note of notes) {
    allNotes[note.fileName] = note;
  }
}

const linksRegex = /\[\[(.+?)\]\]/g;
const highlightsRegex = /\#{2} Highlights*/g;

function processNote(note) {
  // check for wikilinks
  let matches = note.content.match(linksRegex);
  if (matches) {
    matches.forEach((match) => {
      const link = match.slice(2, -2);
      const linkParts = link.split("|");
      const linkedNote = Object.values(allNotes).find(
        (note) => note.shortTitle === linkParts[0]
      );
      // if there is a linked note, replace with markdown link
      if (linkedNote) {
        const linkText = linkParts[1] || linkedNote.title
        note.content = note.content.replace(
          match,
          `[${linkText}](/${linkedNote.collection}/${linkedNote.slug}/)`
        );
        // if there is a linked image, replace with markdown link
      } else if ([".webp", ".png", ".jpg"].some(extension => linkParts[0].endsWith(extension))) {
        const linkText = linkParts[1] || ""
        // Get asset directory relative to the nesting of the note
        const nesting = note.collection.split("/").length + 1; // Up one more to the /src directory
        const up = Array.from({ length: nesting }, () => '../').join('');
        const imageDirectory = config.astroImagesPath.split("/").pop();
        note.content = note.content.replace(
          match,
          `[${linkText}](${up}${imageDirectory}/${linkParts[0]})`
        )
      } else {
        // if there is no linked note, remove wikilink
        const linkText = linkParts[1] || linkParts[0]
        note.content = note.content.replace(match, linkText);
      }
    });
  }

  // remove highlights from book notes
  matches = note.content.match(highlightsRegex);
  if (matches) {
    matches.forEach((match) => {
      note.content = note.content.split(match)[0]
    })

    // add other processors here

  }

  return note;
}

function writeNote(note) {
  if (!note) {
    console.log(note);
  }
  const processedNote = processNote(note);
  console.log(`Writing ${note.fileName} to ${config.astroNotesPath}/${processedNote.collection}/${processedNote.slug}.md`);
  return fsp.writeFile(
    config.astroNotesPath + "/" + processedNote.collection + "/" + processedNote.slug + ".md",
    processedNote.content
  );
}

async function updateNote(path) {
  const fileName = path.split("/").slice(config.vaultNotesPath.split("/").length).join("/");
  const note = await getNote(fileName);
  if (!note) {
    let image = {}
    image["fileName"] = fileName.split("/").pop()
    image["vaultTitle"] = fileName
    copyImage(image)
    return
  };
  allNotes[note] = note;
  writeNote(note);
}

/**
 * Images
 */

async function copyImages() {
  let images = await fsp.readdir(config.vaultNotesPath, { recursive: true });
  images = images.filter((fileName) => [".webp", ".png", ".jpg"].some(extension => fileName.endsWith(extension)));
  return Promise.all(images.map((image) => copyImage(image)));
}

function isImageInNoteContent(image) {
  return Object.values(allNotes).some((note) => note.content.includes(image));
}

async function copyImage(image) {
  if (!isImageInNoteContent(image.fileName)) return;
  console.log(`Copying ${image.fileName}...`);
  return fsp.copyFile(
    config.vaultNotesPath + "/" + image.vaultTitle,
    config.astroImagesPath + "/" + image.fileName
  );
}

/**
 * Watchers
 */

function startWatcher() {
  console.log(
    `Watching ${config.vaultNotesPath} for changes...`
  );
  const noteWatcher = chokidar.watch(config.vaultNotesPath, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
  });
  noteWatcher
    .on("add", (path) => updateNote(path))
    .on("change", (path) => updateNote(path));
}

// Read all notes, copy all images, start the watcher
readNotes().then(copyImages).then(startWatcher);
