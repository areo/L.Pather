enum Mode {
    VIEW = 1,
    CREATE = 2,
    EDIT = 4,
    DELETE = 8,
    APPEND = 16,
    EDIT_APPEND = 4 | 16,
    ALL = 1 | 2 | 4 | 8 | 16
}

export default Mode
