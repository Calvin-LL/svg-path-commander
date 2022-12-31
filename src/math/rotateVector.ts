/**
 * Returns an {x,y} vector rotated by a given
 * angle in radian.
 *
 * @param x the initial vector x
 * @param y the initial vector y
 * @param rad the radian vector angle
 * @returns the rotated vector
 */
const rotateVector = (x: number, y: number, rad: number): { x: number; y: number } => {
  const X = x * Math.cos(rad) - y * Math.sin(rad);
  const Y = x * Math.sin(rad) + y * Math.cos(rad);
  return { x: X, y: Y };
};

export default rotateVector;
