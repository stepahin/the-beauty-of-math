export class MasonryGallery {
    constructor(svgFiles) {
        this.svgFiles = svgFiles
        this.loadedImages = 0
        this.currentIndex = 0
        this.batchSize = 30 // Уменьшаем размер батча
        this.columns = []
        this.columnHeights = []
        this.isLoading = false
        this.visibleItems = new Set()
        this.observer = null
        this.isMobile = window.innerWidth <= 768
    }

    async init() {
        this.container = document.getElementById('masonryGrid')
        this.loader = document.getElementById('loader')
        
        document.getElementById('totalCount').textContent = this.svgFiles.length
        
        this.setupColumns()
        this.setupIntersectionObserver()
        this.setupLoaderAnimation()
        await this.loadBatch()
        this.setupEventListeners()
    }

    setupLoaderAnimation() {
        const indicator = this.loader.querySelector('.loading-indicator')
        if (!indicator) return
        
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        let frameIndex = 0
        
        this.loaderInterval = setInterval(() => {
            if (this.isLoading) {
                indicator.textContent = frames[frameIndex]
                frameIndex = (frameIndex + 1) % frames.length
            }
        }, 80)
    }

    setupColumns() {
        // Проверяем мобильное устройство
        this.isMobile = window.innerWidth <= 768
        
        if (this.isMobile) {
            // Для мобильных - простой контейнер
            this.container.className = 'mobile-container'
            return
        }
        
        // Для десктопа - оригинальная логика
        const containerWidth = this.container.offsetWidth
        let numColumns
        
        if (containerWidth >= 1800) {
            numColumns = 4
        } else if (containerWidth >= 1400) {
            numColumns = 3
        } else if (containerWidth >= 900) {
            numColumns = 2
        } else {
            numColumns = 1
        }
        
        this.container.innerHTML = ''
        this.container.className = 'masonry-grid'
        this.columns = []
        this.columnHeights = []
        
        for (let i = 0; i < numColumns; i++) {
            const column = document.createElement('div')
            column.className = 'masonry-column'
            this.container.appendChild(column)
            this.columns.push(column)
            this.columnHeights.push(0)
        }
    }

    setupIntersectionObserver() {
        // Для мобильных устройств отключаем виртуализацию
        if (this.isMobile) {
            return
        }
        
        // Полная виртуализация только для десктопа
        this.observer = new IntersectionObserver((entries) => {
            requestAnimationFrame(() => {
                entries.forEach(entry => {
                    const item = entry.target
                    const img = item.querySelector('img')
                    
                    if (entry.isIntersecting) {
                        // Элемент в области видимости - загружаем изображение
                        if (img && !img.src && img.dataset.src) {
                            img.src = img.dataset.src
                        }
                    } else {
                        // Элемент вне области видимости
                        // Проверяем, насколько далеко элемент от viewport
                        const rect = entry.boundingClientRect
                        const threshold = 2000 // Порог в пикселях
                        
                        if (rect.bottom < -threshold || rect.top > window.innerHeight + threshold) {
                            // Элемент далеко за пределами экрана - выгружаем изображение
                            if (img && img.src && img.complete) {
                                // Сохраняем URL перед выгрузкой
                                img.dataset.src = img.src
                                // Очищаем src для освобождения памяти
                                img.removeAttribute('src')
                                // Убираем класс загрузки
                                img.classList.remove('loaded')
                                // Добавляем placeholder обратно
                                if (!item.querySelector('.loading-placeholder')) {
                                    const placeholder = document.createElement('div')
                                    placeholder.className = 'loading-placeholder'
                                    item.insertBefore(placeholder, img)
                                }
                            }
                        }
                    }
                })
            })
        }, {
            rootMargin: '500px', // Область предзагрузки
            threshold: 0
        })
    }

    async loadBatch() {
        if (this.isLoading || this.currentIndex >= this.svgFiles.length) return
        
        this.isLoading = true
        this.loader.style.display = 'block'
        
        const endIndex = Math.min(this.currentIndex + this.batchSize, this.svgFiles.length)
        const batch = this.svgFiles.slice(this.currentIndex, endIndex)
        
        // Создаем элементы параллельно, но не ждем загрузки изображений
        const promises = batch.map(filename => this.createImageElement(filename))
        await Promise.all(promises)
        
        this.currentIndex = endIndex
        this.isLoading = false
        this.loader.style.display = 'none'
        
        document.getElementById('loadedCount').textContent = this.currentIndex
    }

    createImageElement(filename) {
        return new Promise((resolve) => {
            if (this.isMobile) {
                // Упрощенная версия для мобильных
                const img = document.createElement('img')
                img.src = `${import.meta.env.BASE_URL}mathworld_svgs/${filename}`
                img.alt = filename
                img.className = 'mobile-image'
                
                img.onload = () => {
                    this.loadedImages++
                }
                
                img.onerror = () => {
                    console.error(`Failed to load: ${filename}`)
                }
                
                this.container.appendChild(img)
                resolve()
                return
            }
            
            // Десктопная версия остается без изменений
            const item = document.createElement('div')
            item.className = 'masonry-item'
            
            const placeholder = document.createElement('div')
            placeholder.className = 'loading-placeholder'
            item.appendChild(placeholder)
            
            const img = document.createElement('img')
            img.dataset.src = `${import.meta.env.BASE_URL}mathworld_svgs/${filename}`
            img.alt = filename
            img.loading = 'lazy'
            
            img.onload = () => {
                const placeholders = item.querySelectorAll('.loading-placeholder')
                placeholders.forEach(p => p.remove())
                img.classList.add('loaded')
                this.loadedImages++
                
                setTimeout(() => {
                    const columnIndex = Array.from(this.columns).findIndex(col => col.contains(item))
                    if (columnIndex !== -1) {
                        this.updateColumnHeight(columnIndex)
                    }
                }, 100)
            }
            
            img.onerror = () => {
                console.error(`Failed to load: ${filename}`)
                item.remove()
            }
            
            item.appendChild(img)
            
            const shortestColumnIndex = this.getShortestColumnIndex()
            this.columns[shortestColumnIndex].appendChild(item)
            
            if (this.observer) {
                this.observer.observe(item)
            }
            
            const rect = item.getBoundingClientRect()
            if (rect.bottom >= -500 && rect.top <= window.innerHeight + 500) {
                img.src = img.dataset.src
            }
            
            resolve()
        })
    }

    getShortestColumnIndex() {
        // Для мобильных возвращаем 0
        if (this.isMobile || !this.columns.length) return 0
        
        // Находим колонку с минимальной высотой
        let minHeight = this.columns[0].offsetHeight
        let minIndex = 0
        
        for (let i = 1; i < this.columns.length; i++) {
            const height = this.columns[i].offsetHeight
            if (height < minHeight) {
                minHeight = height
                minIndex = i
            }
        }
        
        return minIndex
    }
    
    updateColumnHeight(index) {
        if (this.columns[index]) {
            this.columnHeights[index] = this.columns[index].offsetHeight
        }
    }

    setupEventListeners() {
        // Оптимизированный скролл
        let ticking = false
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll()
                    ticking = false
                })
                ticking = true
            }
        })
        
        // Ресайз окна
        let resizeTimeout
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout)
            resizeTimeout = setTimeout(() => {
                const wasMobile = this.isMobile
                const isNowMobile = window.innerWidth <= 768
                
                if (wasMobile !== isNowMobile) {
                    // Перезагружаем страницу при смене режима
                    window.location.reload()
                } else if (!this.isMobile) {
                    const oldColumnCount = this.columns.length
                    this.setupColumns()
                    
                    if (oldColumnCount !== this.columns.length) {
                        this.redistributeItems()
                    }
                }
            }, 250)
        })
        
    }

    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const windowHeight = window.innerHeight
        const documentHeight = document.documentElement.scrollHeight
        
        // Загружаем больше при приближении к низу
        if (scrollTop + windowHeight >= documentHeight - 1000) {
            this.loadBatch()
        }
    }

    redistributeItems() {
        // На мобильных не перераспределяем
        if (this.isMobile) return
        
        const items = Array.from(this.container.querySelectorAll('.masonry-item'))
        
        this.columns.forEach(col => col.innerHTML = '')
        this.columnHeights.fill(0)
        
        items.forEach(item => {
            const shortestColumnIndex = this.getShortestColumnIndex()
            this.columns[shortestColumnIndex].appendChild(item)
            // Пересоздаем observer для элемента
            this.observer.observe(item)
        })
        
        // Проверяем видимость после перераспределения
        setTimeout(() => {
            items.forEach(item => {
                const rect = item.getBoundingClientRect()
                const img = item.querySelector('img')
                if (rect.bottom >= 0 && rect.top <= window.innerHeight && img && !img.src && img.dataset.src) {
                    img.src = img.dataset.src
                }
            })
        }, 100)
    }
}