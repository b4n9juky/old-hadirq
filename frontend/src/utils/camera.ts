export async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'videoinput');
}

export function getDefaultDeviceId(devices: MediaDeviceInfo[]): string | undefined {
  if (devices.length === 0) return undefined;
  if (devices.length === 1) return devices[0].deviceId;
  const external = devices.find(d => /usb|external|logitech|creative|rapoo/i.test(d.label));
  return external?.deviceId ?? devices[0].deviceId;
}

export function getCameraConstraints(deviceId?: string): MediaTrackConstraints {
  const base = { width: { ideal: 1280 }, height: { ideal: 720 } };
  if (deviceId) return { ...base, deviceId: { exact: deviceId } };
  return { ...base, facingMode: 'user' };
}

export function pickCameraDevices(devices: MediaDeviceInfo[], count: number): MediaDeviceInfo[] {
  if (devices.length === 0) return [];
  const requested = Math.max(1, Math.min(count, devices.length));
  const external = devices.filter(d => /usb|external|logitech|creative|rapoo|webcam|facecam|hd|4k|4mp|1080p/i.test(d.label));
  const pool = [...external, ...devices.filter(d => !external.includes(d))];
  const seen = new Set<string>();
  const picked: MediaDeviceInfo[] = [];
  for (const d of pool) {
    if (!seen.has(d.deviceId)) {
      seen.add(d.deviceId);
      picked.push(d);
    }
    if (picked.length === requested) break;
  }
  return picked;
}

export function getCameraGridClass(count: number): string {
  switch (count) {
    case 4: return 'grid-cols-2 grid-rows-2';
    case 3: return 'grid-cols-3';
    case 2: return 'grid-cols-2';
    default: return 'grid-cols-1';
  }
}

export async function loadKioskCameraCount(kioskKey: string): Promise<number> {
  try {
    const res = await fetch('/api/kiosk/config', { headers: { 'x-kiosk-token': kioskKey } });
    if (!res.ok) return 1;
    const data = await res.json();
    if (data.success && data.data?.cameraCount) return data.data.cameraCount;
  } catch { /* ignore */ }
  return 1;
}
