import { ImageResponse } from 'next/og';
import { ClientificMark } from '@/components/brand/ClientificLogo';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #07131f 0%, #0b1825 100%)',
        }}
      >
        <ClientificMark
          title="Clientific apple icon"
          style={{
            width: 126,
            height: 126,
            color: '#ffffff',
          }}
        />
      </div>
    ),
    size
  );
}
