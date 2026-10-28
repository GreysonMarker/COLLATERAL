export const chargeAmount=seconds=>Math.min(1,Math.max(0,seconds/1.5));
export const jumpImpulse=charge=>8.4+(25.2*Math.sqrt(3)-8.4)*Math.min(1,Math.max(0,charge));
