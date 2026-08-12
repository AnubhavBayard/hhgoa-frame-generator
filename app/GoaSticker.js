import { C } from '../lib/brand';

// Pink outline hugs the letterforms — stroke-linejoin rounds the corners and
// paint-order keeps the stroke behind the yellow fill. A CSS text-stroke can do
// neither.
export default function GoaSticker({ className }) {
  return (
    <svg className={className} viewBox="0 0 300 150" overflow="visible" aria-label="गोवा">
      <text
        x="150"
        y="112"
        textAnchor="middle"
        fontFamily="Yatra One"
        fontSize="100"
        fill={C.yellow}
        stroke={C.pink}
        strokeWidth="30"
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        गोवा
      </text>
    </svg>
  );
}
