export const styleDefinitions = {
  youtuber: {
    styleName: "YoutuberStyle",
    assDefinition: "Style: YoutuberStyle,Roboto,52,&H00FFFFFF,&H000000FF,&HFF000000,&HD0FFB6C1,1,0,0,0,100,100,0,0,3,3,2,2,10,10,10,1"
  },
  supreme: {
    styleName: "SupremeStyle",
    assDefinition: "Style: SupremeStyle,Impact,60,&H00F2FF76,&H000000FF,&HFF000000,&HD0ADD8E6,1,0,0,0,100,100,0,0,3,4,2,2,10,10,10,1"
  },
  neon: {
    styleName: "NeonStyle",
    assDefinition: "Style: NeonStyle,Arial,48,&H00F2FF76,&H000000FF,&HFF000000,&HDD000000,0,0,0,0,100,100,0,0,3,5,2,2,10,10,10,1"
  },
  glitch: {
    styleName: "GlitchStyle",
    assDefinition: "Style: GlitchStyle,Courier New,48,&H00F2FF76,&H000000FF,&HFF000000,&HD08A2BE,0,0,0,0,100,100,0,0,3,4,2,2,10,10,10,1"
  },
  fire: {
    styleName: "FireStyle",
    assDefinition: "Style: FireStyle,Verdana,48,&H00FF4500,&H000000FF,&HFF000000,&HD0FFA500,0,0,0,0,100,100,0,0,3,6,2,2,10,10,10,1"
  },
  futuristic: {
    styleName: "FuturisticStyle",
    assDefinition: "Style: FuturisticStyle,Monaco,48,&H0000FFFF,&H000000FF,&HFF000000,&HD0C0C0C,0,0,0,0,100,100,0,0,3,5,2,2,10,10,10,1"
  },
  default: {
    styleName: "DefaultStyle",
    assDefinition: "Style: DefaultStyle,Roboto,52,&H00FFFFFF,&H000000FF,&HFF000000,&HD0D0D0D,0,0,0,0,100,100,0,0,3,3,2,2,10,10,10,1"
  },
};

export function getAssStyleInfoFromCaptionId(captionId) {
  switch (captionId) {
    case "1": return styleDefinitions.youtuber;
    case "2": return styleDefinitions.supreme;
    case "3": return styleDefinitions.neon;
    case "4": return styleDefinitions.glitch;
    case "5": return styleDefinitions.fire;
    case "6": return styleDefinitions.futuristic;
    default: return styleDefinitions.default;
  }
}

function convertToAssTime(time) {
  const h = Math.floor(time / 3600);
  const m = Math.floor((time % 3600) / 60);
  const s = (time % 60).toFixed(2).padStart(5, "0");
  return `${h}:${m.toString().padStart(2, "0")}:${s}`;
}

/**
 * Converts full VTT content into an ASS subtitle file.
 */
export function vttToAss(vttContent, assStyleInfo) {
  const lines = vttContent.split(/\r?\n\r?\n/).filter(block => block.trim() && !block.startsWith("WEBVTT"));
  const scriptInfo = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

`;
  const stylesSection = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${assStyleInfo.assDefinition}

`;
  const eventsHeader = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  let eventsContent = "";
  for (const block of lines) {
    const blockLines = block.split(/\r?\n/);
    const match = blockLines[0].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (match) {
      const startTime = convertToAssTime(parseFloat(match[1].replace(/:/g, ".")));
      const endTime = convertToAssTime(parseFloat(match[2].replace(/:/g, ".")));
      let text = blockLines.slice(1).join("\\N").replace(/,/g, "\\,");
      eventsContent += `Dialogue: 0,${startTime},${endTime},${assStyleInfo.styleName},,0,0,0,,${text}\n`;
    }
  }
  return scriptInfo + stylesSection + eventsHeader + eventsContent;
}

/**
 * Generates an ASS subtitle file that highlights each word individually using karaoke timing.
 * @param {Array} wordsArray - Array of words with properties: word, start, end.
 * @param {Object} baseStyle - The base style info to use.
 * @returns {string} The complete ASS subtitle file as a string.
 */
export function wordsToAss(wordsArray, baseStyle) {
  const scriptInfo = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

`;

  const stylesSection = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${baseStyle.assDefinition}

`;

  const eventsHeader = `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let eventsContent = "";
  for (const wordObj of wordsArray) {
    const startTime = convertToAssTime(wordObj.start);
    const endTime = convertToAssTime(wordObj.end);

    // Compute word duration in centiseconds for karaoke timing
    const duration = Math.round((wordObj.end - wordObj.start) * 100);

    // Apply Karaoke Highlighting (\k)
    const text = `{\\k${duration}}${wordObj.word}`;

    eventsContent += `Dialogue: 0,${startTime},${endTime},${baseStyle.styleName},,0,0,0,,${text}\n`;
  }

  return scriptInfo + stylesSection + eventsHeader + eventsContent;
}
