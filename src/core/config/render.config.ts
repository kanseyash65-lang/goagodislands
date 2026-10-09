/** 3D rendering tunables. */
export const PIXEL_RATIO_MAX = 2;
export const SHADOW_MAP_SIZE = 2048;
export const SHADOW_EXTENT = 130;

export const CAMERA_FOV = 32;
export const CAMERA_NEAR = 1;
export const CAMERA_FAR = 3000;
export const CAMERA_YAW = Math.PI / 4; // diamond view, beach toward the camera
export const CAMERA_PITCH = 0.78; // radians above the horizon
export const CAMERA_PITCH_MIN = 0.45;
export const CAMERA_PITCH_MAX = 1.35;
export const CAMERA_DIST_START = 260;
export const CAMERA_DIST_MIN = 45;
export const CAMERA_DIST_MAX = 480;
export const CAMERA_EASE = 7;
export const ZOOM_STEP = 1.12;
export const ORBIT_SPEED = 0.006;
export const USER_PAUSE_SECONDS = 4;
export const ARROW_PAN_SPEED = 0.6; // view distances per second
export const BOUNDS_PAD = 40;

export const SHAKE_PER_MAGNITUDE = 0.12;
export const SHAKE_DECAY = 5;
export const PUNCH_PER_MAGNITUDE = 0.012;
export const PUNCH_DECAY = 3.5;

export const OCEAN_SIZE = 2400;
export const OCEAN_SEGMENTS = 220;
export const SKY_RADIUS = 1400;

export const MAX_PARTICLES = 6000;
export const MAX_HEALTH_BARS = 512;
export const MAX_LABELS = 48;

export const RAIN_PER_SEC = 900;
export const SNOW_PER_SEC = 260;
export const LOW_FPS_THRESHOLD = 40;
export const WINDMILL_SPIN = 0.9;
export const GOD_ALTITUDE = 34;
export const LABEL_SLOTS = 32;
