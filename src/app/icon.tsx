import { ImageResponse } from 'next/og';
import { ClientificMark } from '@/components/brand/ClientificLogo';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
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
          title="Clientific icon"
          style={{
            width: 360,
            height: 360,
            color: '#ffffff',
          }}
        />
      </div>
    ),
    size
  );
}
