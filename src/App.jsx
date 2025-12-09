import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

// AddCircle Icon Component
const AddCircleIcon = ({ className, style }) => (
  <svg
    className={className}
    style={style}
    xmlns="http://www.w3.org/2000/svg"
    height="45"
    viewBox="0 0 24 24"
    width="45"
    fill="currentColor"
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
  </svg>
)

// Backend API path - modify if needed
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

// Format date based on time elapsed
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  // 방금 (less than 1 hour ago)
  if (diffMins < 60) {
    if (diffMins < 1) {
      return 'Edited just now'
    }
    return `Edited ${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  }

  // 오늘 (same day)
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    const timeStr = date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return `Edited ${timeStr}`
  }

  // 며칠 전 (same year, different day)
  if (date.getFullYear() === now.getFullYear()) {
    const monthStr = date.toLocaleString('en-US', { month: 'short' })
    return `Edited ${monthStr} ${date.getDate()}`
  }

  // 오래전 (different year)
  const monthStr = date.toLocaleString('en-US', { month: 'short' })
  return `Edited ${monthStr} ${date.getDate()}, ${date.getFullYear()}`
}

// Highlight search query in text
const highlightText = (text, query) => {
  if (!query || !text || !query.trim()) return text

  const queryLower = query.toLowerCase().trim()
  const textLower = text.toLowerCase()
  const parts = []
  let lastIndex = 0
  let index = textLower.indexOf(queryLower, lastIndex)

  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index))
    }
    // Add highlighted match
    parts.push(
      <mark key={index} className="search-highlight">
        {text.substring(index, index + query.length)}
      </mark>
    )
    lastIndex = index + query.length
    index = textLower.indexOf(queryLower, lastIndex)
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? <>{parts}</> : text
}

function App() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all', 'active', 'completed'
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSearchForm, setShowSearchForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [currentTodo, setCurrentTodo] = useState(null)
  const [todoToDelete, setTodoToDelete] = useState(null)
  const [detailFormData, setDetailFormData] = useState({ title: '', content: '' })
  const [addFormData, setAddFormData] = useState({ title: '', content: '' })
  const [showTitleInput, setShowTitleInput] = useState(false)
  const [shakeAddButton, setShakeAddButton] = useState(false)
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [showNoSelectionModal, setShowNoSelectionModal] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedTodos, setSelectedTodos] = useState([])
  const [restoreMode, setRestoreMode] = useState(false)
  const [confettiItems, setConfettiItems] = useState([])
  const [praiseMessage, setPraiseMessage] = useState(null)
  const [deletedTodos, setDeletedTodos] = useState(() => {
    const saved = localStorage.getItem('deletedTodos')
    return saved ? JSON.parse(saved) : []
  })
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })
  
  const saveTimeoutRef = useRef(null)
  const textareaRef = useRef(null)
  const todoInputRef = useRef(null)
  const searchInputRef = useRef(null)

  // Fetch all todos
  const fetchTodos = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/todos`)
      if (!response.ok) {
        throw new Error(`Failed to fetch todos: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setTodos(Array.isArray(data) ? data : [])
      setError(null)
    } catch (err) {
      const errorMsg = err.message.includes('404')
        ? 'Please check backend API path. (Current: /api/todos)'
        : 'Cannot connect to backend server. (localhost:5000)'
      setError(errorMsg)
      console.error('Error fetching todos:', err)
      setTodos([])
    } finally {
      setLoading(false)
    }
  }

  // Create a new todo
  const createTodo = async (e) => {
    if (e) e.preventDefault()
    const title = addFormData.title.trim()
    const content = addFormData.content.trim()

    if (!title && !content) {
      // Shake animation instead of alert
      setShakeAddButton(true)
      setTimeout(() => setShakeAddButton(false), 500)
      return
    }

    const requestBody = {
      // If only title is entered: title = title, content = ''
      // If only content is entered: title = 'Untitled', content = content
      // If both are entered: title = title, content = content
      title: title || 'Untitled',
      content: content || '', // If only title is entered, content should be empty
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      await fetchTodos()
      setAddFormData({ title: '', content: '' })
      setShowAddForm(false)
      setShowTitleInput(false)
      setError(null)
      // Hide input after successful creation
      if (todoInputRef.current) {
        todoInputRef.current.blur()
      }
    } catch (err) {
      console.error('Error creating todo:', err)
      let errorMessage = err.message
      if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend server. (localhost:5000)'
      }
      setError(errorMessage)
    }
  }

  // Update a todo
  const updateTodo = async (id, updates) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/todos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const updatedTodo = await response.json()
      await fetchTodos()
      // Update currentTodo if it's the one being edited
      if (currentTodo && currentTodo._id === id) {
        setCurrentTodo(updatedTodo)
      }
      setError(null)
      return updatedTodo
    } catch (err) {
      const errorMessage =
        err.message.includes('fetch')
          ? 'Cannot connect to backend server. (localhost:5000)'
          : err.message
      setError(errorMessage)
      console.error('Error updating todo:', err)
      throw err
    }
  }

  // Delete a todo
  const confirmDelete = async () => {
    if (!todoToDelete) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/todos/${todoToDelete._id}`, {
        method: 'DELETE',
      })

      if (!response.ok && response.status !== 404) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      // Save to deletedTodos before removing
      const deletedTodo = {
        ...todoToDelete,
        deletedAt: new Date().toISOString()
      }
      setDeletedTodos(prev => [deletedTodo, ...prev])

      await fetchTodos()
      setError(null)
      setShowDeleteModal(false)
      setTodoToDelete(null)
      if (currentTodo && currentTodo._id === todoToDelete._id) {
        setShowDetailModal(false)
        setCurrentTodo(null)
      }
    } catch (err) {
      const errorMessage =
        err.message.includes('fetch')
          ? 'Cannot connect to backend server. (localhost:5000)'
          : err.message
      setError(errorMessage)
      console.error('Error deleting todo:', err)
      setShowDeleteModal(false)
      setTodoToDelete(null)
    }
  }

  // Restore a deleted todo
  const restoreTodo = async (deletedTodo) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: deletedTodo.title || 'Untitled',
          content: deletedTodo.content || '',
          pinned: deletedTodo.pinned || false,
          completed: deletedTodo.completed || false,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      // Remove from deletedTodos
      setDeletedTodos(prev => prev.filter(todo => todo._id !== deletedTodo._id))
      await fetchTodos()
      setError(null)
    } catch (err) {
      const errorMessage =
        err.message.includes('fetch')
          ? 'Cannot connect to backend server. (localhost:5000)'
          : err.message
      setError(errorMessage)
      console.error('Error restoring todo:', err)
    }
  }

  // Restore multiple deleted todos
  const restoreMultipleTodos = async () => {
    if (selectedTodos.length === 0) return
    
    const todosToRestore = deletedTodos.filter(todo => selectedTodos.includes(todo._id))
    
    try {
      // Restore all selected todos
      const restorePromises = todosToRestore.map(deletedTodo =>
        fetch(`${API_BASE_URL}/api/todos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: deletedTodo.title || 'Untitled',
            content: deletedTodo.content || '',
            pinned: deletedTodo.pinned || false,
            completed: deletedTodo.completed || false,
          }),
        })
      )

      const responses = await Promise.all(restorePromises)
      const allOk = responses.every(response => response.ok)
      
      if (!allOk) {
        throw new Error('Some todos failed to restore')
      }

      // Remove restored todos from deletedTodos
      setDeletedTodos(prev => prev.filter(todo => !selectedTodos.includes(todo._id)))
      setSelectedTodos([])
      await fetchTodos()
      setError(null)
    } catch (err) {
      const errorMessage =
        err.message.includes('fetch')
          ? 'Cannot connect to backend server. (localhost:5000)'
          : err.message
      setError(errorMessage)
      console.error('Error restoring todos:', err)
    }
  }

  // Toggle todo selection
  const toggleTodoSelection = (todoId) => {
    setSelectedTodos(prev => {
      if (prev.includes(todoId)) {
        return prev.filter(id => id !== todoId)
      } else {
        return [...prev, todoId]
      }
    })
  }

  // Select all todos (toggle)
  const selectAllTodos = () => {
    const allTodoIds = todos.map(todo => todo._id)
    const allSelected = allTodoIds.length > 0 && 
                       allTodoIds.length === selectedTodos.length && 
                       allTodoIds.every(id => selectedTodos.includes(id))
    
    if (allSelected) {
      // If all are selected, deselect all
      setSelectedTodos([])
    } else {
      // Otherwise, select all
      setSelectedTodos(allTodoIds)
    }
  }

  // Delete all todos
  const deleteAllTodos = async () => {
    try {
      // Save to deletedTodos before deleting
      const deletedTodosWithDate = todos.map(todo => ({
        ...todo,
        deletedAt: new Date().toISOString()
      }))
      setDeletedTodos(prev => [...deletedTodosWithDate, ...prev])
      
      // Delete all todos one by one
      const deletePromises = todos.map(todo =>
        fetch(`${API_BASE_URL}/api/todos/${todo._id}`, {
          method: 'DELETE',
        })
      )
      
      await Promise.all(deletePromises)
      await fetchTodos()
      setError(null)
      setShowDeleteAllModal(false)
      setShowHeaderMenu(false)
      setSelectionMode(false)
      setSelectedTodos([])
    } catch (err) {
      const errorMessage =
        err.message.includes('fetch')
          ? 'Cannot connect to backend server. (localhost:5000)'
          : err.message
      setError(errorMessage)
      console.error('Error deleting all todos:', err)
      setShowDeleteAllModal(false)
      setShowHeaderMenu(false)
    }
  }

  // Delete selected todos
  const deleteSelectedTodos = async () => {
    try {
      // Get todos to be deleted
      const todosToDelete = todos.filter(todo => selectedTodos.includes(todo._id))
      
      // Delete selected todos one by one
      const deletePromises = selectedTodos.map(todoId =>
        fetch(`${API_BASE_URL}/api/todos/${todoId}`, {
          method: 'DELETE',
        })
      )
      
      await Promise.all(deletePromises)
      
      // Save to deletedTodos
      const deletedTodosWithDate = todosToDelete.map(todo => ({
        ...todo,
        deletedAt: new Date().toISOString()
      }))
      setDeletedTodos(prev => [...deletedTodosWithDate, ...prev])
      
      await fetchTodos()
      setError(null)
      setShowDeleteAllModal(false)
      setShowHeaderMenu(false)
      setSelectionMode(false)
      setSelectedTodos([])
    } catch (err) {
      const errorMessage =
        err.message.includes('fetch')
          ? 'Cannot connect to backend server. (localhost:5000)'
          : err.message
      setError(errorMessage)
      console.error('Error deleting selected todos:', err)
      setShowDeleteAllModal(false)
    }
  }

  // Toggle pinned status
  const togglePinned = async (todo) => {
    await updateTodo(todo._id, {
      content: todo.content,
      title: todo.title,
      pinned: !todo.pinned,
      completed: todo.completed || false,
    })
  }

  // Play sound effect: 도미솔도
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      
      // 도미솔도 음계 주파수 (Hz)
      const notes = [261.63, 329.63, 392.00, 523.25] // 도, 미, 솔, 도
      const noteDuration = 0.1 // 각 음의 지속 시간 (초)
      const noteGap = 0.025 // 음 사이 간격 (초)
      
      notes.forEach((frequency, index) => {
        const startTime = audioContext.currentTime + index * (noteDuration + noteGap)
        
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.value = frequency
        oscillator.type = 'sine'
        
        // Envelope: 빠르게 시작하고 부드럽게 끝남
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + noteDuration)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  // Toggle completed status
  const triggerConfetti = (todoItemElement, checkboxElement, todoId) => {
    if (!todoItemElement || !checkboxElement) return
    
    // 사운드 이펙트 재생
    playSuccessSound()
    
    const itemRect = todoItemElement.getBoundingClientRect()
    const containerElement = document.querySelector('.container')
    if (!containerElement) return
    
    const containerRect = containerElement.getBoundingClientRect()
    
    // todo-item의 위치를 container 기준으로 상대 좌표로 변환
    const itemLeft = itemRect.left - containerRect.left
    const itemRight = itemRect.right - containerRect.left
    const itemBottom = itemRect.bottom - containerRect.top
    const itemWidth = itemRect.width
    
    // canvas-confetti 표준 각도 (90도 = 위, 시계 방향)
    // JavaScript 표준으로 변환: jsAngle = 90 - canvasAngle (도 단위)
    const leftAngles = [90, 80, 70, 60, 50, 40, 30, 20, 10, 0] // 왼쪽 바닥에서 발사
    const rightAngles = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180] // 오른쪽 바닥에서 발사
    
    const particlesPerAngle = 10
    const newConfetti = []
    const baseId = Date.now()
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a']
    
    let particleId = 0
    
    // 왼쪽 바닥에서 각도별로 발사
    for (let angleIdx = 0; angleIdx < leftAngles.length; angleIdx++) {
      const canvasAngle = leftAngles[angleIdx] // canvas-confetti 표준 각도
      // JavaScript 표준으로 변환: 90도 = 위, 반시계 방향
      const jsAngleDeg = 90 - canvasAngle
      const baseAngleRad = (jsAngleDeg * Math.PI) / 180
      
      for (let i = 0; i < particlesPerAngle; i++) {
        const startX = itemLeft
        const startY = itemBottom
        // 각도에 약간의 랜덤 변동 추가 (±2도)
        const angleRad = baseAngleRad + (Math.random() - 0.5) * (Math.PI / 90)
        const distance = 80 + Math.random() * 60 // 80~140px 거리
        const endX = startX + Math.cos(angleRad) * distance
        const endY = startY - Math.sin(angleRad) * distance // 위로 올라가므로 음수
        const duration = 0.5 // 0.5초로 고정
        
        newConfetti.push({
          id: baseId + particleId++,
          todoId: todoId,
          startX: startX,
          startY: startY,
          endX: endX,
          endY: endY,
          duration: duration,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 2 // 작게: 2~4px
        })
      }
    }
    
    // 오른쪽 바닥에서 각도별로 발사 (왼쪽의 거울상)
    for (let angleIdx = 0; angleIdx < rightAngles.length; angleIdx++) {
      const canvasAngle = rightAngles[angleIdx] // canvas-confetti 표준 각도
      // 왼쪽의 거울상: 각도를 수평 대칭으로 변환
      // 왼쪽: 90° → jsAngle 0° (오른쪽), 0° → jsAngle 90° (위)
      // 오른쪽 거울상: 90° → jsAngle 180° (왼쪽), 180° → jsAngle 90° (위)
      // 수평 대칭: jsAngle = 270 - canvasAngle
      const jsAngleDeg = 270 - canvasAngle
      const baseAngleRad = (jsAngleDeg * Math.PI) / 180
      
      for (let i = 0; i < particlesPerAngle; i++) {
        const startX = itemRight
        const startY = itemBottom
        // 각도에 약간의 랜덤 변동 추가 (±2도)
        const angleRad = baseAngleRad + (Math.random() - 0.5) * (Math.PI / 90)
        const distance = 80 + Math.random() * 60 // 80~140px 거리
        const endX = startX + Math.cos(angleRad) * distance
        const endY = startY - Math.sin(angleRad) * distance // 위로 올라가므로 음수
        const duration = 0.5 // 0.5초로 고정
        
        newConfetti.push({
          id: baseId + particleId++,
          todoId: todoId,
          startX: startX,
          startY: startY,
          endX: endX,
          endY: endY,
          duration: duration,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 2 // 작게: 2~4px
        })
      }
    }
    
    setConfettiItems(prev => [...prev, ...newConfetti])
    
    setTimeout(() => {
      setConfettiItems(prev => prev.filter(item => item.todoId !== todoId || !newConfetti.find(c => c.id === item.id)))
    }, 600)
  }

  const showPraiseMessage = (todoItemElement) => {
    if (!todoItemElement) return
    
    const messages = ["Great job!", "Nice work!", "Keep it up!", "Well done!", "Awesome!", "Fantastic!", "Way to go!", "Excellent!"]
    const randomMessage = messages[Math.floor(Math.random() * messages.length)]
    
    // todo-text 요소 찾기 (없으면 todo-title 사용)
    const textElement = todoItemElement.querySelector('.todo-text') || todoItemElement.querySelector('.todo-title')
    if (!textElement) return
    
    const textRect = textElement.getBoundingClientRect()
    // 텍스트의 가운데 위치 계산
    const centerX = textRect.left + textRect.width / 2
    const centerY = textRect.top + textRect.height / 2
    
    setPraiseMessage({
      id: Date.now(),
      message: randomMessage,
      x: centerX,
      y: centerY
    })
    
    // 음성으로 메시지 읽기 (더 열정적으로)
    if ('speechSynthesis' in window) {
      // 메시지에 더 강조를 위해 느낌표 추가 또는 강조 표현
      const enthusiasticMessage = randomMessage.endsWith('!') 
        ? randomMessage 
        : randomMessage + '!'
      
      const utterance = new SpeechSynthesisUtterance(enthusiasticMessage)
      utterance.rate = 1.4 // 더 빠르게
      utterance.pitch = 1.3 // 더 높고 밝은 톤
      utterance.volume = 1.0 // 최대 볼륨
      
      // 더 자연스러운 강조를 위해 약간의 pause 추가
      speechSynthesis.speak(utterance)
    }
    
    setTimeout(() => {
      setPraiseMessage(null)
    }, 1000)
  }

  const toggleCompleted = async (todo, event) => {
    try {
      const currentCompleted = todo.completed === true // Explicitly check for true
      const newCompleted = !currentCompleted
      console.log('Toggling completed:', { todoId: todo._id, currentCompleted, newCompleted })
      
      // 완료 상태로 변경될 때만 애니메이션 트리거
      if (newCompleted && event) {
        // todo-item 요소 찾기
        const todoItemElement = event.target.closest('.todo-item')
        const checkboxElement = event.target
        if (todoItemElement && checkboxElement) {
          triggerConfetti(todoItemElement, checkboxElement, todo._id)
          showPraiseMessage(todoItemElement)
        }
      }
      
      await updateTodo(todo._id, {
        content: todo.content || '',
        title: todo.title || 'Untitled',
        pinned: todo.pinned || false,
        completed: newCompleted,
      })
      console.log('Completed status updated successfully')
    } catch (error) {
      console.error('Error toggling completed status:', error)
    }
  }

  // Show todo detail modal
  const showTodoDetail = (todo) => {
    setCurrentTodo(todo)
    setDetailFormData({
      title: todo.title || '',
      content: todo.content || '',
    })
    setShowDetailModal(true)
  }

  // Close detail modal
  const closeDetailModal = () => {
    // Save any pending changes before closing
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTodoChanges()
    }
    setShowDetailModal(false)
    setCurrentTodo(null)
  }

  // Save todo changes (debounced)
  const saveTodoChanges = useCallback(async () => {
    if (!currentTodo) return

    const title = detailFormData.title.trim()
    const content = detailFormData.content.trim()

    if (!title && !content) {
      return // Don't save empty todos
    }

    const finalTitle = title || 'Untitled'
    const finalContent = content || title || 'Untitled'

    try {
      await updateTodo(currentTodo._id, {
        title: finalTitle,
        content: finalContent,
        pinned: currentTodo.pinned || false,
        completed: currentTodo.completed || false,
      })
    } catch (error) {
      console.error('Error saving todo changes:', error)
    }
  }, [currentTodo, detailFormData])

  // Debounced save function
  const debounceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTodoChanges()
    }, 500) // Save after 500ms of no typing
  }, [saveTodoChanges])

  // Handle detail form input changes
  const handleDetailInputChange = (field, value) => {
    setDetailFormData((prev) => ({ ...prev, [field]: value }))
    debounceSave()
  }

  // Adjust textarea height
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight)
      const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop)
      const paddingBottom = parseFloat(getComputedStyle(textarea).paddingBottom)
      const padding = paddingTop + paddingBottom
      const minHeight = lineHeight * 3 + padding
      const maxHeight = window.innerHeight * 0.35
      const scrollHeight = textarea.scrollHeight

      if (scrollHeight < minHeight) {
        textarea.style.height = minHeight + 'px'
        textarea.style.overflowY = 'hidden'
      } else if (scrollHeight <= maxHeight) {
        textarea.style.height = scrollHeight + 'px'
        textarea.style.overflowY = 'hidden'
      } else {
        textarea.style.height = maxHeight + 'px'
        textarea.style.overflowY = 'auto'
      }
    }
  }

  useEffect(() => {
    fetchTodos()
  }, [])

  // Save darkMode preference to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
  }, [darkMode])

  // Save deletedTodos to localStorage
  useEffect(() => {
    localStorage.setItem('deletedTodos', JSON.stringify(deletedTodos))
  }, [deletedTodos])

  // Adjust textarea height when detail modal opens or content changes
  useEffect(() => {
    if (showDetailModal && textareaRef.current) {
      setTimeout(() => {
        adjustTextareaHeight()
        textareaRef.current.scrollTop = 0
      }, 100)
    }
  }, [showDetailModal, detailFormData.content])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Keep search form visible when there's a search query
  useEffect(() => {
    if (searchQuery.trim()) {
      setShowSearchForm(true)
      // Force activeTab to 'all' when searching
      setActiveTab('all')
    }
  }, [searchQuery])

  // Filter todos based on search query and active tab
  const filteredTodos = todos.filter((todo) => {
    // Filter by tab
    if (activeTab === 'active' && todo.completed === true) return false
    if (activeTab === 'completed' && todo.completed !== true) return false
    
    // Filter by search query
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const content = (todo.content || '').toLowerCase()
    const title = (todo.title || '').toLowerCase()
    return content.includes(query) || title.includes(query)
  })

  // Sort todos based on active tab
  // For All tab: 1. active + pinned > 2. active + not pinned > 3. completed + pinned > 4. completed + not pinned
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    if (activeTab === 'all') {
      const aActive = a.completed !== true
      const bActive = b.completed !== true
      const aPinned = a.pinned === true
      const bPinned = b.pinned === true
      
      // Calculate priority: active + pinned = 0, active + not pinned = 1, completed + pinned = 2, completed + not pinned = 3
      const getPriority = (active, pinned) => {
        if (active && pinned) return 0
        if (active && !pinned) return 1
        if (!active && pinned) return 2
        return 3 // !active && !pinned
      }
      
      const priorityA = getPriority(aActive, aPinned)
      const priorityB = getPriority(bActive, bPinned)
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
    } else {
      // For other tabs: pinned first, then by createdAt
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
    }
    
    // Within same priority group, sort by createdAt (newest first)
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0)
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0)
    return dateB - dateA
  })

  // Calculate counts for each tab
  const allCount = todos.length
  const activeCount = todos.filter(todo => todo.completed !== true).length
  const completedCount = todos.filter(todo => todo.completed === true).length

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showDeleteModal) {
          setShowDeleteModal(false)
          setTodoToDelete(null)
        } else if (showNoSelectionModal) {
          setShowNoSelectionModal(false)
        } else if (showDetailModal) {
          closeDetailModal()
        } else if (showHeaderMenu) {
          setShowHeaderMenu(false)
        }
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showDeleteModal, showNoSelectionModal, showDetailModal, showHeaderMenu])

  // Close header menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showHeaderMenu && !e.target.closest('.btn-header-menu') && !e.target.closest('.header-menu')) {
        setShowHeaderMenu(false)
      }
    }
    if (showHeaderMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showHeaderMenu])

  return (
      <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="container">
        {/* Confetti Container */}
        <div className="confetti-container">
          {confettiItems.map((confetti) => (
            <div
              key={confetti.id}
              className="confetti-piece"
              style={{
                left: `${confetti.startX}px`,
                top: `${confetti.startY}px`,
                backgroundColor: confetti.color,
                width: `${confetti.size}px`,
                height: `${confetti.size}px`,
                '--start-x': `${confetti.startX}px`,
                '--start-y': `${confetti.startY}px`,
                '--end-x': `${confetti.endX}px`,
                '--end-y': `${confetti.endY}px`,
                '--duration': `${confetti.duration}s`
              }}
            />
          ))}
        </div>
        <header className="header">
          <button
            className="btn-header-menu"
            onClick={(e) => {
              e.stopPropagation()
              setShowHeaderMenu(!showHeaderMenu)
              if (showHeaderMenu) {
                // Close menu and exit modes
                setSelectionMode(false)
                setRestoreMode(false)
                setSelectedTodos([])
              }
            }}
            title="Menu"
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>
          {showHeaderMenu && (
            <div className="header-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className="header-menu-item"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectionMode(true)
                  setRestoreMode(false)
                  setShowHeaderMenu(false)
                }}
              >
                <i className="fas fa-trash"></i>
                <span>Delete</span>
              </button>
              <button
                className="header-menu-item"
                onClick={(e) => {
                  e.stopPropagation()
                  setRestoreMode(true)
                  setSelectionMode(true)
                  setSelectedTodos([])
                  setShowHeaderMenu(false)
                }}
              >
                <i className="fas fa-rotate-left"></i>
                <span>Restore</span>
              </button>
            </div>
          )}
          <div className="header-title-wrapper">
            <h1 
              onClick={() => {
                setActiveTab('all')
                setSearchQuery('')
                setSelectionMode(false)
                setRestoreMode(false)
                setShowAddForm(false)
                setShowSearchForm(false)
                setSelectedTodos([])
                setShowHeaderMenu(false)
              }}
              style={{ cursor: 'pointer' }}
            >
              TACKLE <span className="title-n">N</span> TRACK
            </h1>            
          </div>
          <button
            className="btn-theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            <i className={darkMode ? 'fas fa-sun' : 'fas fa-moon'}></i>
          </button>
        </header>

        {/* Combined Search and Add Form Container */}
        {(!restoreMode || (restoreMode && selectionMode)) && (
          <div className="search-add-wrapper">
            <div 
              className={`search-add-container ${selectionMode ? 'selection-mode' : ''}`}
            onClick={(e) => {
              // If clicking outside todo-input-container and search-input-wrapper
              if (!e.target.closest('.todo-input-container') && 
                  !e.target.closest('.search-input-wrapper')) {
                // If add form is open and inputs are empty, close it
                if (showAddForm && !addFormData.title.trim() && !addFormData.content.trim()) {
                  setShowAddForm(false)
                  setShowTitleInput(false)
                  setAddFormData({ title: '', content: '' })
                }
                // If search form is open and search query is empty, close it
                if (showSearchForm && !searchQuery.trim()) {
                  setShowSearchForm(false)
                }
              }
            }}
          >
            {!showSearchForm && !showAddForm ? (
              selectionMode ? (
                <>
                  <button
                    className="btn-header-close"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowHeaderMenu(false)
                      setShowDeleteAllModal(false)
                      setSelectionMode(false)
                      setRestoreMode(false)
                      setSelectedTodos([])
                    }}
                    title="Back"
                  >
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  {(() => {
                    if (restoreMode) {
                      // Restore mode: select all deleted todos
                      const allDeletedIds = deletedTodos.map(todo => todo._id)
                      const allSelected = allDeletedIds.length > 0 && 
                                         allDeletedIds.length === selectedTodos.length && 
                                         allDeletedIds.every(id => selectedTodos.includes(id))
                      return (
                        <button
                          className="btn-select-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (allSelected) {
                              setSelectedTodos([])
                            } else {
                              setSelectedTodos(allDeletedIds)
                            }
                          }}
                          title={allSelected ? "Deselect all tasks" : "Select all tasks"}
                        >
                          <i className={allSelected ? "fas fa-circle-check" : "far fa-circle-check"}></i>
                        </button>
                      )
                    } else {
                      // Delete mode: select all todos
                      const allTodoIds = todos.map(todo => todo._id)
                      const allSelected = allTodoIds.length > 0 && 
                                         allTodoIds.length === selectedTodos.length && 
                                         allTodoIds.every(id => selectedTodos.includes(id))
                      return (
                        <button
                          className="btn-select-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            selectAllTodos()
                          }}
                          title={allSelected ? "Deselect all tasks" : "Select all tasks"}
                        >
                          <i className={allSelected ? "fas fa-circle-check" : "far fa-circle-check"}></i>
                        </button>
                      )
                    }
                  })()}
                  {restoreMode ? (
                    <button
                      className="btn-header-menu-inline"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (selectedTodos.length > 0) {
                          restoreMultipleTodos()
                        } else {
                          setShowNoSelectionModal(true)
                        }
                      }}
                      title="Restore"
                    >
                      <i className="fas fa-rotate-left"></i>
                      {selectedTodos.length > 0 && (
                        <span className="btn-header-menu-badge">{selectedTodos.length}</span>
                      )}
                    </button>
                  ) : (
                    <button
                      className="btn-header-menu-inline"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (selectedTodos.length > 0) {
                          setShowDeleteAllModal(true)
                        } else {
                          setShowNoSelectionModal(true)
                        }
                      }}
                      title="Delete"
                    >
                      <i className="fas fa-trash"></i>
                      {selectedTodos.length > 0 && (
                        <span className="btn-header-menu-badge">{selectedTodos.length}</span>
                      )}
                    </button>
                  )}
                </>
              ) : (
                <div className="search-add-icons">
                  <button
                    className="btn-add-circle"
                    onClick={() => {
                      setShowSearchForm(false)
                      setShowAddForm(true)
                      setShowTitleInput(true)
                      setTimeout(() => {
                        todoInputRef.current?.focus()
                      }, 0)
                    }}
                    title="Add"
                  >
                    <AddCircleIcon />
                  </button>
                  <button
                    className="btn-search-icon"
                    onClick={() => {
                      setShowAddForm(false)
                      setShowSearchForm(true)
                      setTimeout(() => {
                        searchInputRef.current?.focus()
                      }, 0)
                    }}
                    title="Search"
                  >
                    <i className="fas fa-search"></i>
                  </button>
                </div>
              )
          ) : showSearchForm ? (
            <div 
              className="search-input-wrapper"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="fas fa-search search-icon"></i>
              <input
                ref={searchInputRef}
                type="text"
                id="searchInput"
                className="search-input"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={(e) => {
                  // Don't hide if clicking on related elements
                  if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
                    // Only hide if search query is empty
                    if (!searchQuery.trim()) {
                      setTimeout(() => {
                        setShowSearchForm(false)
                      }, 200)
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowSearchForm(false)
                    setSearchQuery('')
                  }
                }}
              />
              <button
                className="btn-search-clear"
                onClick={(e) => {
                  e.stopPropagation()
                  setSearchQuery('')
                  setShowSearchForm(false)
                }}
                title="Clear search"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <div className="todo-form-inputs">
              <div 
                className="todo-input-container"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="todo-title-input-wrapper">
                  <input
                    type="text"
                    className="todo-title-input-form"
                    placeholder="Title"
                    value={addFormData.title}
                    onChange={(e) => setAddFormData({ ...addFormData, title: e.target.value })}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        todoInputRef.current?.focus()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-title-clear"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAddFormData({ title: '', content: '' })
                      setShowAddForm(false)
                      setShowTitleInput(false)
                    }}
                    title="Cancel"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="todo-input-row">
                  <input
                    ref={todoInputRef}
                    type="text"
                    id="todoInput"
                    className="todo-input"
                    placeholder="Add a new task..."
                    value={addFormData.content}
                    onChange={(e) => setAddFormData({ ...addFormData, content: e.target.value })}
                    onBlur={(e) => {
                      // Don't hide if clicking on the form or related elements
                      const relatedTarget = e.relatedTarget
                      const titleInput = document.querySelector('.todo-title-input-form')
                      if (!relatedTarget || 
                          (relatedTarget !== titleInput && 
                           !e.currentTarget.contains(relatedTarget) &&
                           relatedTarget !== document.querySelector('.btn-add-task'))) {
                        // Only hide if both inputs are empty
                        if (!addFormData.title.trim() && !addFormData.content.trim()) {
                          setTimeout(() => {
                            setShowAddForm(false)
                            setShowTitleInput(false)
                          }, 200)
                        }
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createTodo(e)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowAddForm(false)
                        setShowTitleInput(false)
                        setAddFormData({ title: '', content: '' })
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={`btn btn-primary btn-add-task ${shakeAddButton ? 'shake' : ''}`}
                    onClick={createTodo}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
          </div>
        )}

        {/* Search Empty State */}
        {!restoreMode && searchQuery.trim() && sortedTodos.length === 0 && !loading && (
          <div className="empty-state search-empty-state">
            <p>No results found</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <span>Error: {error}</span>
            <button onClick={fetchTodos}>Retry</button>
          </div>
        )}

        {/* Restore Mode - Deleted Todos */}
        {restoreMode ? (
          <>
            {deletedTodos.length === 0 ? (
              <div className="empty-state">
                <p>No deleted tasks to restore</p>
              </div>
            ) : (
              <div className="todo-list-container">
                <ul className="todo-list">
                  {[...deletedTodos].sort((a, b) => {
                    const dateA = a.deletedAt ? new Date(a.deletedAt) : new Date(0)
                    const dateB = b.deletedAt ? new Date(b.deletedAt) : new Date(0)
                    return dateB - dateA // Newest first
                  }).map((deletedTodo) => (
                    <li
                      key={deletedTodo._id || Math.random()}
                      className={`todo-item-wrapper deleted ${selectedTodos.includes(deletedTodo._id) ? 'selected' : ''}`}
                      onClick={() => toggleTodoSelection(deletedTodo._id)}
                    >
                      <div className={`todo-item deleted ${deletedTodo.pinned === true ? 'pinned' : ''} ${selectedTodos.includes(deletedTodo._id) ? 'selected' : ''}`}>
                        <div className="todo-content">
                          <input
                            type="checkbox"
                            className="todo-checkbox"
                            checked={deletedTodo.completed === true}
                            readOnly
                            onClick={(e) => {
                              // 이벤트 전파를 막지 않아서 li의 onClick이 실행되도록 함
                            }}
                            title={deletedTodo.completed === true ? 'Completed' : 'Active'}
                          />
                          <div className="todo-content-text">
                            <span className="todo-title">{deletedTodo.title || 'Untitled'}</span>
                            {deletedTodo.content && (
                              <span className="todo-text">{deletedTodo.content}</span>
                            )}
                          </div>
                          <div className="todo-actions">
                            <div
                              className={`todo-pin-indicator ${deletedTodo.pinned ? 'pinned' : 'unpinned'}`}
                              title={deletedTodo.pinned ? 'Pinned' : 'Unpinned'}
                            >
                              <i className="fas fa-thumbtack"></i>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Todo Tabs */}
            <div className="todo-tabs">
              <button
                className={`todo-tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span className="todo-tab-text">ALL</span>
                <span className="todo-tab-badge">{allCount}</span>
              </button>
              <button
                className={`todo-tab ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                <span className="todo-tab-text">ACTIVE</span>
                <span className="todo-tab-badge">{activeCount}</span>
              </button>
              <button
                className={`todo-tab ${activeTab === 'completed' ? 'active' : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                <span className="todo-tab-text">COMPLETED</span>
                <span className="todo-tab-badge">{completedCount}</span>
              </button>
            </div>

            {/* Todo List */}
            {loading ? (
              <div className="loading">Loading...</div>
            ) : sortedTodos.length === 0 && !searchQuery.trim() ? (
              <div className="empty-state">
                <p>No tasks yet. Add one above!</p>
              </div>
            ) : (
              <div className={`todo-list-container ${selectionMode ? 'selection-mode' : ''}`}>
                <ul className="todo-list">
                  {sortedTodos.map((todo) => (
                <li
                  key={todo._id}
                  className={`todo-item-wrapper ${todo.completed === true ? 'completed' : ''} ${selectedTodos.includes(todo._id) ? 'selected' : ''}`}
                  onClick={() => {
                    if (selectionMode) {
                      toggleTodoSelection(todo._id)
                    } else {
                      showTodoDetail(todo)
                    }
                  }}
                >
                  <div className={`todo-item ${todo.completed === true ? 'completed' : ''} ${todo.pinned === true ? 'pinned' : ''} ${selectedTodos.includes(todo._id) ? 'selected' : ''}`}>
                    <div className="todo-content">
                      <input
                        type="checkbox"
                        className="todo-checkbox"
                        checked={todo.completed === true}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (selectionMode) {
                            toggleTodoSelection(todo._id)
                          }
                        }}
                        onChange={(e) => {
                          e.stopPropagation()
                          if (!selectionMode) {
                            toggleCompleted(todo, e)
                          }
                        }}
                        title={selectionMode ? 'Select task' : (todo.completed === true ? 'Mark as active' : 'Mark as completed')}
                      />
                      <div className="todo-content-text">
                        <span className="todo-title">
                          {searchQuery.trim() 
                            ? highlightText(todo.title || 'Untitled', searchQuery)
                            : (todo.title || 'Untitled')
                          }
                        </span>
                        {todo.content && (
                          <span className="todo-text">
                            {searchQuery.trim() 
                              ? highlightText(todo.content, searchQuery)
                              : todo.content
                            }
                          </span>
                        )}
                      </div>
                      <div className="todo-actions">
                        <div
                          className={`todo-pin-indicator ${todo.pinned ? 'pinned' : 'unpinned'} ${selectionMode ? 'selection-mode' : ''}`}
                          title={selectionMode ? 'Selection mode' : (todo.pinned ? 'Unpin' : 'Pin')}
                          onClick={(e) => {
                            if (selectionMode) {
                              // In selection mode, don't stop propagation so parent onClick handles selection
                              // The parent li's onClick will call toggleTodoSelection
                            } else {
                              e.stopPropagation()
                              togglePinned(todo)
                            }
                          }}
                        >
                          <i className="fas fa-thumbtack"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
          </>
        )}

        {/* Todo Detail Modal */}
        {showDetailModal && currentTodo && (
          <div className="modal show" onClick={(e) => {
            if (e.target.classList.contains('modal')) {
              closeDetailModal()
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <button className="btn btn-back" title="Back" onClick={closeDetailModal}>
                  <i className="fas fa-arrow-left"></i>
                </button>
                <div className="modal-actions">
                  <button
                    className="btn btn-pin"
                    title={currentTodo.pinned ? 'Unpin' : 'Pin'}
                    onClick={() => togglePinned(currentTodo)}
                  >
                    <i className="fas fa-thumbtack" style={{ color: currentTodo.pinned ? (darkMode ? '#ac86f6' : '#6b78e6') : '#999' }}></i>
                  </button>
                  <button
                    className="btn btn-danger"
                    title="Delete"
                    onClick={() => {
                      setTodoToDelete(currentTodo)
                      setShowDeleteModal(true)
                    }}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="todo-title-input"
                  placeholder="Title"
                  value={detailFormData.title}
                  onChange={(e) => handleDetailInputChange('title', e.target.value)}
                  onClick={(e) => {
                    e.target.readOnly = false
                    e.target.focus()
                    e.target.select()
                  }}
                  onBlur={(e) => {
                    e.target.readOnly = true
                  }}
                  readOnly
                />
                <div className="textarea-wrapper">
                  <textarea
                    ref={textareaRef}
                    className="todo-text-input"
                    placeholder="Task description..."
                    value={detailFormData.content}
                    onChange={(e) => {
                      handleDetailInputChange('content', e.target.value)
                      adjustTextareaHeight()
                    }}
                  />
                  <div className="last-edited-time">
                    {formatDate(currentTodo.updatedAt || currentTodo.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Delete All/Selected Confirmation Modal */}
        {showDeleteAllModal && (
          <div className="modal show" onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteAllModal(false)
              setShowHeaderMenu(false)
              setSelectionMode(false)
              setSelectedTodos([])
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="delete-confirm-modal">
                <h2>Delete {selectedTodos.length > 0 ? 'Selected' : 'All'} Tasks</h2>
                <p>
                  {selectedTodos.length > 0 ? (() => {
                    const count = selectedTodos.length
                    return (
                      <>
                        Are you sure you want to delete {count} task{count === 1 ? '' : 's'}?<br />
                        You can always restore {count === 1 ? 'it' : 'them'} later.
                      </>
                    )
                  })() : (
                    <>Are you sure you want to delete all tasks?<br />You can always restore them later.</>
                  )}
                </p>
                <div className="modal-buttons">
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (selectedTodos.length > 0) {
                        deleteSelectedTodos()
                      } else {
                        deleteAllTodos()
                      }
                    }}
                  >
                    Delete
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowDeleteAllModal(false)
                      setShowHeaderMenu(false)
                      setSelectionMode(false)
                      setSelectedTodos([])
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Selection Modal */}
        {showNoSelectionModal && (
          <div className="modal show" onClick={(e) => {
            if (e.target.classList.contains('modal')) {
              setShowNoSelectionModal(false)
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header modal-header-center">
                <h2>No Tasks Selected</h2>
              </div>
              <div className="modal-body modal-body-center">
                <p>Please select tasks you want to {restoreMode ? 'restore' : 'delete'}.</p>
              </div>
              <div className="modal-buttons">
                <button className="btn btn-primary" onClick={() => {
                  setShowNoSelectionModal(false)
                }}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="modal show" onClick={(e) => {
            if (e.target.classList.contains('modal')) {
              setShowDeleteModal(false)
              setTodoToDelete(null)
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="delete-confirm-modal">
                <h2>Delete Task</h2>
                <p>Are you sure you want to delete this task?<br />You can always restore it later.</p>
                <div className="modal-buttons">
                  <button className="btn btn-danger" onClick={confirmDelete}>
                    Delete
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Praise Message */}
      {praiseMessage && (
        <div
          className="praise-message"
          style={{
            left: `${praiseMessage.x}px`,
            top: `${praiseMessage.y}px`
          }}
        >
          {praiseMessage.message}
        </div>
      )}
    </div>
  )
}

export default App
