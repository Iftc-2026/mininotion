import type {Config} from 'tailwindcss';
const font=['Helvetica Neue ME','Helvetica','Arial','sans-serif'];
export default {content:['./app.html','./*.{ts,tsx}'],theme:{extend:{colors:{cream:'#efeee9',ink:'#141414'},fontFamily:{hn:font,sans:font,serif:font}}},plugins:[]} satisfies Config;
