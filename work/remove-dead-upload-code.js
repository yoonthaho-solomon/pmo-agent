const fs = require('fs');
const p = 'app/MatchingLab.tsx';
let s = fs.readFileSync(p, 'utf8');
s = s.replace("import { useEffect, useMemo, useRef, useState } from 'react'", "import { useEffect, useMemo, useState } from 'react'");
s = s.replace(/\ninterface UploadResult \{[\s\S]*?\n\}\n\ninterface CallcardRow/, '\ninterface CallcardRow');
s = s.replace(/\nfunction FilePicker\([\s\S]*?\n\}\n\nfunction DataLoadTab/, '\nfunction DataLoadTab');
fs.writeFileSync(p, s, 'utf8');
