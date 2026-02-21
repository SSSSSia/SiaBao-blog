import { toast } from 'react-toastify'

const BASE_OPTIONS = {
  className: 'admin-save-toast',
  bodyClassName: 'admin-save-toast__body',
  progressClassName: 'admin-save-toast__progress',
  closeButton: false,
  pauseOnHover: true,
  pauseOnFocusLoss: false,
  closeOnClick: true,
  draggable: false,
  position: 'top-center',
}

// SVG 图标字符串
const SUCCESS_ICON = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 12l2.5 2.5L16 9"/>
  </svg>
`

const ERROR_ICON = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10"/>
    <path d="M15 9l-6 6M9 9l6 6"/>
  </svg>
`

const INFO_ICON = `
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4M12 8h.01"/>
  </svg>
`

export const adminToast = {
  saveSuccess(message) {
    return toast.success(message, {
      ...BASE_OPTIONS,
      className: `${BASE_OPTIONS.className} admin-save-toast--success`,
      icon: SUCCESS_ICON,
      autoClose: 1500,
    })
  },
  saveError(message) {
    return toast.error(message, {
      ...BASE_OPTIONS,
      className: `${BASE_OPTIONS.className} admin-save-toast--error`,
      icon: ERROR_ICON,
      autoClose: 1500,
    })
  },
  saveInfo(message) {
    return toast.info(message, {
      ...BASE_OPTIONS,
      className: `${BASE_OPTIONS.className} admin-save-toast--info`,
      icon: INFO_ICON,
      autoClose: 1500,
    })
  },
}

