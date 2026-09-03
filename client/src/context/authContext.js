import { createContext } from 'react'

// context 物件單獨放一個檔：AuthContext.jsx 只 export 元件，Vite fast refresh 才生效
export const AuthContext = createContext(null)
