// Copyright 2022 Edvin Tela. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Data } from './src/data';
import * as fs from 'fs';

import { TEST_DATA, TEST_CASES } from './tests';

const rx = /(\r\n|\n|\r|\s)+/gm;
function stringify(o: any, maxCols = 200) {
  const s = JSON.stringify(o, null, 1);
  if (s.length > maxCols) {
    return s;
  }
  return s.replace(rx, ' ');
}

const lines: string[] = ['# jsqn', 'JSON Query Notation', 'Example Data: ', '```'];
lines.push(stringify(TEST_DATA));
lines.push('```');

TEST_CASES.forEach((tc) => {
  lines.push(tc.comment.replace(rx, ' '));
  if (tc.selector != null && tc.result != null) {
    lines.push('```');
    lines.push('Selector: ' + stringify(tc.selector));
    lines.push('Output: ' + stringify(tc.result));
    lines.push('```');
  }
});

fs.writeFileSync('README.md', lines.join('\n'));
