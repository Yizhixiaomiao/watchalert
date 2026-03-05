"use client"

import { useState, useEffect } from "react"
import {
    Descriptions,
    Tag,
    Button,
    Space,
    Divider,
    Timeline,
    Input,
    List,
    Avatar,
    message,
    Modal,
    Form,
    Spin,
    Typography,
    Row,
    Col,
    Empty,
    Select,
    Carousel,
    Image,
    Card,
    Table,
    Alert,
} from "antd"
import {
    UserAddOutlined,
    CloseOutlined,
    CheckOutlined,
    ReloadOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SendOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    FileTextOutlined,
    SearchOutlined,
    EyeOutlined,
} from "@ant-design/icons"
import { useNavigate, useParams } from "react-router-dom"
import {
    getTicket,
    assignTicket,
    claimTicket,
    resolveTicket,
    closeTicket,
    reopenTicket,
    addTicketComment,
    getTicketComments,
    getTicketWorkLogs,
    addTicketStep,
    updateTicketStep,
    deleteTicketStep,
    getTicketSteps,
} from "../../api/ticket"
import { getKnowledges, createKnowledge, getKnowledgeCategories } from "../../api/knowledge"
import { clearCacheByUrl } from "../../utils/http"
import { HandleApiError, FormatTime } from "../../utils/lib"
import { getUserList } from "../../api/user"
import LazyImage from "../../components/LazyImage"

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography

export const TicketDetail = () => {
    const navigate = useNavigate()
    const { id } = useParams()
    const [ticket, setTicket] = useState(null)
    const [loading, setLoading] = useState(false)
    const [comments, setComments] = useState([])
    const [workLogs, setWorkLogs] = useState([])
    const [newComment, setNewComment] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [assignModalVisible, setAssignModalVisible] = useState(false)
    const [resolveModalVisible, setResolveModalVisible] = useState(false)
    const [imagePreviewVisible, setImagePreviewVisible] = useState(false)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [userList, setUserList] = useState([])
    const [steps, setSteps] = useState([])
    const [stepModalVisible, setStepModalVisible] = useState(false)
    const [editingStep, setEditingStep] = useState(null)
    const [stepForm] = Form.useForm()
    const [form] = Form.useForm()
    const [knowledgeList, setKnowledgeList] = useState([])
    const [selectedKnowledge, setSelectedKnowledge] = useState(null)
    const [knowledgeModalVisible, setKnowledgeModalVisible] = useState(false)
    const [knowledgeForm] = Form.useForm()
    const [knowledgeCategories, setKnowledgeCategories] = useState([])
    const [knowledgeTags, setKnowledgeTags] = useState([])
    const [knowledgeTagInput, setKnowledgeTagInput] = useState('')
    const [knowledgeSelectorVisible, setKnowledgeSelectorVisible] = useState(false)
    const [knowledgeSelectorSearch, setKnowledgeSelectorSearch] = useState('')
    const [knowledgeSelectorFilter, setKnowledgeSelectorFilter] = useState('')
    const [knowledgeSelectorTagFilter, setKnowledgeSelectorTagFilter] = useState('')
    const [selectedKnowledgeId, setSelectedKnowledgeId] = useState(null)
    const [knowledgeSelectorList, setKnowledgeSelectorList] = useState([])
    const [knowledgeSelectorLoading, setKnowledgeSelectorLoading] = useState(false)
    const [knowledgeSelectorPagination, setKnowledgeSelectorPagination] = useState({ current: 1, pageSize: 10, total: 0 })
    const [allKnowledgeTags, setAllKnowledgeTags] = useState([])

    // 清理标题，去掉括号前缀
    const cleanTitle = (title) => {
        if (!title) return title
        return title.replace(/^\[[^\]]+\]\s*/, '')
    }

    // 提取故障描述（在联系信息之前的部分）
    const getFaultDescription = (description) => {
        if (!description) return description
        const contactIndex = description.indexOf('\n\n联系人:')
        return contactIndex > -1 ? description.substring(0, contactIndex) : description
    }

    // 渲染结构化的故障描述
    const renderFaultDescription = (description) => {
        if (!description) return <Text type="secondary">暂无故障描述</Text>

        const sections = description.split('##').filter(s => s.trim())
        const result = []

        sections.forEach((section, index) => {
            const lines = section.trim().split('\n').filter(l => l.trim())
            if (lines.length === 0) return

            const title = lines[0].trim()

            // 告警详情部分
            if (title.includes('告警详情')) {
                const details = {}
                lines.slice(1).forEach(line => {
                    const match = line.match(/\*\*(.*?)\*\*:\s*(.*)/)
                    if (match) {
                        details[match[1]] = match[2]
                    }
                })

                result.push(
                    <Card 
                        key={`alert-details-${index}`} 
                        size="small" 
                        style={{ marginBottom: 12, background: '#fff7e6', border: '1px solid #ffd591' }}
                        title={<span style={{ color: '#d46b08' }}>📊 告警详情</span>}
                    >
                        <Descriptions column={2} size="small">
                            {Object.entries(details).map(([key, value]) => (
                                <Descriptions.Item key={key} label={key}>
                                    {key === '严重程度' ? (
                                        <Tag color={value === 'P1' ? 'red' : value === 'P2' ? 'orange' : 'blue'}>
                                            {value}
                                        </Tag>
                                    ) : (
                                        value
                                    )}
                                </Descriptions.Item>
                            ))}
                        </Descriptions>
                    </Card>
                )
            }
            // 告警标签部分
            else if (title.includes('告警标签')) {
                const tags = []
                lines.slice(1).forEach(line => {
                    const match = line.match(/-\s+\*\*(.*?)\*\*:\s*(.*)/)
                    if (match) {
                        tags.push({ key: match[1], value: match[2] })
                    }
                })

                result.push(
                    <Card 
                        key={`alert-tags-${index}`} 
                        size="small" 
                        style={{ marginBottom: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}
                        title={<span style={{ color: '#389e0d' }}>🏷️ 告警标签</span>}
                    >
                        <Space wrap>
                            {tags.map(tag => (
                                <Tag key={tag.key} style={{ marginBottom: 4 }}>
                                    <Text style={{ color: '#8c8c8c' }}>{tag.key}:</Text> {tag.value}
                                </Tag>
                            ))}
                        </Space>
                    </Card>
                )
            }
            // 处理建议部分
            else if (title.includes('处理建议')) {
                const suggestions = lines.slice(1).filter(l => l.trim().match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))

                result.push(
                    <Alert
                        key={`suggestions-${index}`}
                        type="info"
                        message="处理建议"
                        description={
                            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                                {suggestions.map((s, i) => (
                                    <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                                ))}
                            </ul>
                        }
                        style={{ marginBottom: 12 }}
                    />
                )
            }
        })

        return result.length > 0 ? result : <Text type="secondary">{description}</Text>
    }

    // 状态映射
    const statusMap = {
        Pending: { color: "default", text: "待处理" },
        Assigned: { color: "blue", text: "已分配" },
        Processing: { color: "processing", text: "处理中" },
        Verifying: { color: "purple", text: "验证中" },
        Resolved: { color: "success", text: "已解决" },
        Closed: { color: "default", text: "已关闭" },
        Cancelled: { color: "error", text: "已取消" },
        Escalated: { color: "warning", text: "已升级" },
    }

    // 优先级映射
    const priorityMap = {
        P0: { color: "red", text: "P0-最高" },
        P1: { color: "orange", text: "P1-高" },
        P2: { color: "blue", text: "P2-中" },
        P3: { color: "green", text: "P3-低" },
        P4: { color: "default", text: "P4-最低" },
    }

    // 工单类型映射
    const typeMap = {
        Alert: { text: "告警工单" },
        Fault: { text: "故障工单" },
        Change: { text: "变更工单" },
        Query: { text: "咨询工单" },
    }

useEffect(() => {
        fetchUserList()
        fetchTicketDetail()
        fetchComments()
        fetchWorkLogs()
        fetchSteps()
        fetchKnowledgeList()
        fetchKnowledgeCategories()
    }, [id])

    // 键盘事件处理
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (!imagePreviewVisible) return
            
            const imageCount = ticket?.customFields?.images?.length || ticket?.images?.length || 0
            if (e.key === 'ArrowLeft' && currentImageIndex > 0) {
                setCurrentImageIndex(currentImageIndex - 1)
            } else if (e.key === 'ArrowRight' && currentImageIndex < imageCount - 1) {
                setCurrentImageIndex(currentImageIndex + 1)
            } else if (e.key === 'Escape') {
                setImagePreviewVisible(false)
            }
        }

        if (imagePreviewVisible) {
            document.addEventListener('keydown', handleKeyPress)
            return () => document.removeEventListener('keydown', handleKeyPress)
        }
    }, [imagePreviewVisible, currentImageIndex, ticket?.customFields?.images, ticket?.images])

    // 获取用户列表
    const fetchUserList = async () => {
        try {
            const res = await getUserList({})
            if (res && res.data) {
                const users = Array.isArray(res.data) ? res.data : []
                setUserList(users)
            }
        } catch (error) {
            console.error("获取用户列表失败:", error)
        }
    }

    // 获取工单详情
    const fetchTicketDetail = async () => {
        setLoading(true)
        try {
            const res = await getTicket({ ticketId: id })
            if (res && res.data) {
                setTicket(res.data)
            }
        } catch (error) {
            HandleApiError(error)
        } finally {
            setLoading(false)
        }
    }

    // 获取评论列表
    const fetchComments = async () => {
        try {
            const res = await getTicketComments({ ticketId: id, page: 1, size: 100 })
            if (res && res.data) {
                setComments(res.data.list || [])
            }
        } catch (error) {
            console.error("获取评论失败:", error)
        }
    }

    // 获取工作日志
    const fetchWorkLogs = async () => {
        try {
            const res = await getTicketWorkLogs({ ticketId: id, page: 1, size: 100 })
            if (res && res.data) {
                setWorkLogs(res.data.list || [])
            }
        } catch (error) {
            console.error("获取工作日志失败:", error)
        }
    }

    // 获取处理步骤
    const fetchSteps = async () => {
        try {
            const res = await getTicketSteps({ ticketId: id }, { skipCache: true })
            if (res && res.data) {
                setSteps([...(res.data || [])])  // 使用扩展运算符创建新数组，确保触发更新
            }
        } catch (error) {
            console.error("获取处理步骤失败:", error)
        }
    }

    // 获取知识库列表
    const fetchKnowledgeList = async () => {
        try {
            const res = await getKnowledges({ status: 'published', page: 1, size: 100 })
            if (res && res.data) {
                setKnowledgeList(res.data.list || [])
            }
        } catch (error) {
            console.error("获取知识库列表失败:", error)
        }
    }

    // 获取知识库分类
    const fetchKnowledgeCategories = async () => {
        try {
            const res = await getKnowledgeCategories({ isActive: true, page: 1, size: 100 })
            if (res && res.data) {
                setKnowledgeCategories(res.data.list || [])
            }
        } catch (error) {
            console.error("获取知识库分类失败:", error)
        }
    }

    // 添加步骤
    const handleAddStep = async (values) => {
        try {
            const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.order)) : 0
            const knowledgeIds = selectedKnowledgeId ? [selectedKnowledgeId] : []
            await addTicketStep({
                ticketId: id,
                order: maxOrder + 1,
                title: values.title,
                description: values.description,
                method: values.method,
                result: values.result,
                attachments: values.attachments || [],
                knowledgeIds: knowledgeIds,
            })
            setStepModalVisible(false)
            stepForm.resetFields()
            setEditingStep(null)
            setSelectedKnowledge(null)
            setSelectedKnowledgeId(null)
            clearCacheByUrl('/api/w8t/ticket/steps')
            await fetchSteps()
            await fetchWorkLogs()
        } catch (error) {
            HandleApiError(error)
        }
    }

    // 编辑步骤
    const handleEditStep = (step) => {
        setEditingStep(step)
        stepForm.setFieldsValue(step)
        // 加载已关联的知识
        if (step.knowledgeIds && step.knowledgeIds.length > 0) {
            setSelectedKnowledgeId(step.knowledgeIds[0])
            const knowledge = knowledgeList.find(k => k.knowledgeId === step.knowledgeIds[0])
            setSelectedKnowledge(knowledge || null)
        } else {
            setSelectedKnowledge(null)
            setSelectedKnowledgeId(null)
        }
        setStepModalVisible(true)
    }

    // 更新步骤
    const handleUpdateStep = async (values) => {
        try {
            const knowledgeIds = selectedKnowledgeId ? [selectedKnowledgeId] : []
            await updateTicketStep({
                ticketId: id,
                stepId: editingStep.stepId,
                ...values,
                knowledgeIds: knowledgeIds,
            })
            setStepModalVisible(false)
            stepForm.resetFields()
            setEditingStep(null)
            setSelectedKnowledge(null)
            setSelectedKnowledgeId(null)
            clearCacheByUrl('/api/w8t/ticket/steps')
            await fetchSteps()
        } catch (error) {
            HandleApiError(error)
        }
    }

    // 删除步骤
    const handleDeleteStep = (stepId) => {
        Modal.confirm({
            title: "确认删除",
            content: "确定要删除这个步骤吗？",
            onOk: async () => {
                try {
                    await deleteTicketStep({ ticketId: id, stepId })
                    clearCacheByUrl('/api/w8t/ticket/steps')
                    // 先设置为空数组，强制更新
                    setSteps([])
                    // 稍微延迟后重新获取，确保状态变化被检测到
                    await new Promise(resolve => setTimeout(resolve, 100))
                    await fetchSteps()
                    await fetchWorkLogs()
                } catch (error) {
                    HandleApiError(error)
                }
            },
        })
    }

    // 打开添加步骤弹窗
    const openAddStepModal = () => {
        setEditingStep(null)
        stepForm.resetFields()
        setSelectedKnowledge(null)
        setSelectedKnowledgeId(null)
        setStepModalVisible(true)
    }

    // 打开知识库选择器
    const openKnowledgeSelector = async () => {
        setKnowledgeSelectorVisible(true)
        setKnowledgeSelectorSearch('')
        setKnowledgeSelectorFilter('')
        setKnowledgeSelectorTagFilter('')
        setSelectedKnowledgeId(null)
        // 加载知识库列表和所有标签
        await Promise.all([
            fetchKnowledgeSelectorList({ page: 1, size: 10 }),
            fetchAllKnowledgeTags()
        ])
    }

    // 加载知识库选择器列表
    const fetchKnowledgeSelectorList = async (params) => {
        setKnowledgeSelectorLoading(true)
        try {
            const searchParams = {
                status: 'published',
                ...params,
            }
            if (knowledgeSelectorSearch) {
                searchParams.keyword = knowledgeSelectorSearch
            }
            if (knowledgeSelectorFilter) {
                searchParams.category = knowledgeSelectorFilter
            }
            if (knowledgeSelectorTagFilter) {
                searchParams.keyword = knowledgeSelectorTagFilter
            }

            const res = await getKnowledges(searchParams, { skipCache: true })
            if (res && res.data && res.data.list) {
                setKnowledgeSelectorList(res.data.list || [])
                setKnowledgeSelectorPagination({
                    current: res.data.page || 1,
                    pageSize: res.data.size || 10,
                    total: res.data.total || 0,
                })
            }
        } catch (error) {
            console.error('加载知识库列表失败:', error)
            message.error('加载知识库列表失败')
        } finally {
            setKnowledgeSelectorLoading(false)
        }
    }

    // 获取所有知识库标签
    const fetchAllKnowledgeTags = async () => {
        try {
            const res = await getKnowledges({ status: 'published', page: 1, size: 1000 }, { skipCache: true })
            if (res && res.data && res.data.list) {
                const tagsSet = new Set()
                res.data.list.forEach(item => {
                    if (item.tags && Array.isArray(item.tags)) {
                        item.tags.forEach(tag => tagsSet.add(tag))
                    }
                })
                setAllKnowledgeTags(Array.from(tagsSet))
            }
        } catch (error) {
            console.error('获取知识库标签失败:', error)
        }
    }

    // 知识库选择器搜索
    const handleKnowledgeSelectorSearch = () => {
        fetchKnowledgeSelectorList({ page: 1, size: 10 })
    }

    // 知识库选择器分类过滤
    const handleKnowledgeSelectorFilterChange = (value) => {
        setKnowledgeSelectorFilter(value)
        fetchKnowledgeSelectorList({ page: 1, size: 10, category: value })
    }

    // 知识库选择器标签过滤
    const handleKnowledgeSelectorTagFilterChange = (tag) => {
        const newFilter = knowledgeSelectorTagFilter === tag ? '' : tag
        setKnowledgeSelectorTagFilter(newFilter)
        fetchKnowledgeSelectorList({ page: 1, size: 10, keyword: newFilter })
    }

    // 知识库选择器分页
    const handleKnowledgeSelectorTableChange = (pagination) => {
        fetchKnowledgeSelectorList({
            page: pagination.current,
            size: pagination.pageSize,
        })
    }

    // 选择知识
    const handleSelectKnowledge = (knowledge) => {
        setSelectedKnowledge(knowledge)
        setSelectedKnowledgeId(knowledge.knowledgeId)
        setKnowledgeSelectorVisible(false)
        // 从知识库内容中提取处理方法部分
        const methodContent = extractMethodFromKnowledge(knowledge.content || knowledge.contentText || '')
        stepForm.setFieldsValue({
            method: methodContent,
        })
    }

    // 从知识库HTML内容中提取处理方法部分
    const extractMethodFromKnowledge = (content) => {
        if (!content) return ''
        
        // 如果是纯文本（没有HTML标签），尝试提取处理方法部分
        if (!content.includes('<')) {
            const methodMatch = content.match(/处理方法[：:]\s*([\s\S]*?)(?=验证结果|$)/i)
            if (methodMatch && methodMatch[1]) {
                return methodMatch[1].trim()
            }
            return content
        }
        
        // 如果是HTML内容，解析并提取处理方法部分
        const parser = new DOMParser()
        const doc = parser.parseFromString(content, 'text/html')
        
        // 查找所有包含"处理方法"的元素
        const methodElements = doc.querySelectorAll('*')
        let methodContent = ''
        let foundMethod = false
        
        for (const el of methodElements) {
            const text = el.textContent || ''
            if (text.includes('处理方法') || text.includes('处理步骤')) {
                // 找到处理方法后，提取后续内容
                const parts = text.split(/处理方法[：:]/i)
                if (parts.length > 1) {
                    methodContent = parts[1].split(/验证结果[：:]/i)[0].trim()
                    foundMethod = true
                    break
                }
            }
        }
        
        // 如果没有找到处理方法，尝试提取"处理步骤"部分
        if (!foundMethod) {
            const stepsSection = doc.querySelector('.steps-list, ol')
            if (stepsSection) {
                methodContent = stepsSection.innerHTML
            }
        }
        
        return methodContent || content
    }

    // 同步到知识库
    const handleSyncToKnowledge = () => {
        const faultDescription = getFaultDescription(ticket.description) || ticket.description || ''
        
        const stepsContent = steps.length > 0 ? `
<div class="knowledge-section">
    <h3>📋 处理步骤</h3>
    <ol class="steps-list">
        ${steps.map((step, index) => `
            <li class="step-item">
                <div class="step-header">
                    <strong>步骤 ${index + 1}：${step.title}</strong>
                    ${step.createdAt ? `<span class="step-time">${FormatTime(step.createdAt)}</span>` : ''}
                </div>
                ${step.description ? `
                <div class="step-content">
                    <span class="step-label">问题描述：</span>
                    <p>${step.description}</p>
                </div>` : ''}
                ${step.method ? `
                <div class="step-content">
                    <span class="step-label">处理方法：</span>
                    <div class="step-method">${step.method}</div>
                </div>` : ''}
                ${step.result ? `
                <div class="step-content">
                    <span class="step-label">验证结果：</span>
                    <p>${step.result}</p>
                </div>` : ''}
            </li>`).join('')}
    </ol>
</div>` : ''

        const content = `
<div class="knowledge-content">
    <!-- 故障描述 -->
    <div class="knowledge-section">
        <h3>🔴 故障描述</h3>
        <div class="section-content">
            <p>${faultDescription.replace(/\n/g, '<br>')}</p>
        </div>
    </div>

    <!-- 根因分析 -->
    ${ticket.rootCause ? `
    <div class="knowledge-section">
        <h3>🔍 根因分析</h3>
        <div class="section-content">
            <p>${ticket.rootCause.replace(/\n/g, '<br>')}</p>
        </div>
    </div>` : ''}

    <!-- 解决方案 -->
    ${ticket.solution ? `
    <div class="knowledge-section">
        <h3>✅ 解决方案</h3>
        <div class="section-content">
            <p>${ticket.solution.replace(/\n/g, '<br>')}</p>
        </div>
    </div>` : ''}

    <!-- 处理步骤 -->
    ${stepsContent}

    <!-- 元数据信息 -->
    <div class="knowledge-section meta-section">
        <h3>📊 关联信息</h3>
        <div class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">工单编号：</span>
                <span class="meta-value">${ticket.ticketNo}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">工单类型：</span>
                <span class="meta-value">${typeMap[ticket.type]?.text || ticket.type}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">优先级：</span>
                <span class="meta-value">${priorityMap[ticket.priority]?.text || ticket.priority}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">创建时间：</span>
                <span class="meta-value">${FormatTime(ticket.createdAt)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">处理状态：</span>
                <span class="meta-value">${statusMap[ticket.status]?.text || ticket.status}</span>
            </div>
        </div>
    </div>
</div>

<style>
.knowledge-content {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #333;
}

.knowledge-section {
    margin-bottom: 24px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #1890ff;
}

.knowledge-section h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1890ff;
}

.section-content {
    padding: 12px;
    background: white;
    border-radius: 4px;
}

.section-content p {
    margin: 8px 0;
    color: #555;
}

.steps-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.step-item {
    padding: 16px;
    margin-bottom: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e8e8e8;
}

.step-item:last-child {
    margin-bottom: 0;
}

.step-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid #f0f0f0;
}

.step-header strong {
    font-size: 15px;
    color: #262626;
}

.step-time {
    font-size: 12px;
    color: #999;
}

.step-content {
    margin-top: 8px;
}

.step-label {
    font-weight: 600;
    color: #595959;
    font-size: 13px;
}

.step-method {
    margin-top: 6px;
    padding: 10px;
    background: #f0f9ff;
    border-left: 3px solid #1890ff;
    border-radius: 4px;
    white-space: pre-wrap;
    color: #262626;
}

.meta-section {
    border-left-color: #52c41a;
}

.meta-section h3 {
    color: #52c41a;
}

.meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    padding: 12px;
    background: white;
    border-radius: 4px;
}

.meta-item {
    display: flex;
    flex-direction: column;
    padding: 8px;
    background: #fafafa;
    border-radius: 4px;
}

.meta-label {
    font-size: 12px;
    color: #8c8c8c;
    margin-bottom: 4px;
}

.meta-value {
    font-size: 14px;
    font-weight: 500;
    color: #262626;
}
</style>
        `.trim()

        const defaultTags = [ticket.type, ticket.priority].filter(Boolean)
        setKnowledgeTags(defaultTags)

        knowledgeForm.setFieldsValue({
            title: cleanTitle(ticket.title),
            content: content,
        })

        setKnowledgeModalVisible(true)
    }

    const handleAddKnowledgeTag = () => {
        if (knowledgeTagInput && !knowledgeTags.includes(knowledgeTagInput)) {
            setKnowledgeTags([...knowledgeTags, knowledgeTagInput])
            setKnowledgeTagInput('')
        }
    }

    const handleRemoveKnowledgeTag = (tagToRemove) => {
        setKnowledgeTags(knowledgeTags.filter((tag) => tag !== tagToRemove))
    }

    // 创建知识
    const handleCreateKnowledge = async (values) => {
        try {
            const res = await createKnowledge({
                title: values.title,
                category: values.category,
                tags: knowledgeTags,
                content: values.content,
                sourceTicket: ticket.ticketId,
            })
            setKnowledgeModalVisible(false)
            knowledgeForm.resetFields()
            setKnowledgeTags([])
            setKnowledgeTagInput('')
            
            // 更新工单的knowledgeId
            if (res && res.data) {
                setTicket(prev => ({
                    ...prev,
                    knowledgeId: res.data
                }))
            }
            
            message.success('已成功同步到知识库')
            fetchKnowledgeList()
        } catch (error) {
            HandleApiError(error)
        }
    }

    // 添加评论
    const handleAddComment = async () => {
        if (!newComment.trim()) {
            message.warning("请输入评论内容")
            return
        }

        setSubmitting(true)
        try {
            await addTicketComment({
                ticketId: id,
                content: newComment,
            })
            setNewComment("")
            fetchComments()
            fetchWorkLogs()
        } catch (error) {
            HandleApiError(error)
        } finally {
            setSubmitting(false)
        }
    }

    // 认领工单
    const handleClaim = async () => {
        try {
            await claimTicket({ ticketId: id })
            fetchTicketDetail()
            fetchWorkLogs()
        } catch (error) {
            HandleApiError(error)
        }
    }

    // 分配工单
    const handleAssign = async (values) => {
        try {
            await assignTicket({
                ticketId: id,
                assignedTo: values.assignedTo,
                reason: values.reason,
            })
            setAssignModalVisible(false)
            form.resetFields()
            fetchTicketDetail()
            fetchWorkLogs()
        } catch (error) {
            HandleApiError(error)
        }
    }

    // 标记解决
    const handleResolve = async (values) => {
        try {
            await resolveTicket({
                ticketId: id,
                solution: values.solution,
                rootCause: values.rootCause,
            })
            setResolveModalVisible(false)
            form.resetFields()
            fetchTicketDetail()
            fetchWorkLogs()
        } catch (error) {
            HandleApiError(error)
        }
    }

    // 关闭工单
    const handleClose = async () => {
        Modal.confirm({
            title: "确认关闭",
            content: "确定要关闭这个工单吗？",
            onOk: async () => {
                try {
                    await closeTicket({ ticketId: id, reason: "手动关闭" })
                    fetchTicketDetail()
                    fetchWorkLogs()
                } catch (error) {
                    HandleApiError(error)
                }
            },
        })
    }

    // 重新打开工单
    const handleReopen = async () => {
        Modal.confirm({
            title: "确认重新打开",
            content: "确定要重新打开这个工单吗？",
            onOk: async () => {
                try {
                    await reopenTicket({ ticketId: id, reason: "需要继续处理" })
                    fetchTicketDetail()
                    fetchWorkLogs()
                } catch (error) {
                    HandleApiError(error)
                }
            },
        })
    }

    // 获取用户名
    const getUserName = (userId) => {
        if (!userId) return "-"
        const user = userList.find(u => u.userid === userId)
        return user ? (user.username || userId) : userId
    }

    // 将工作日志中的用户ID替换为用户名
    const formatWorkLogContent = (content) => {
        if (!content) return content
        
        // 匹配常见的工作日志模式，将用户ID替换为用户名
        let formattedContent = content
        
        // 匹配"分配工单给 [userID]"、"转派给 [userID]"等模式
        userList.forEach(user => {
            if (user.userid && content.includes(user.userid)) {
                const userName = user.username || user.userid
                // 转义特殊字符以防止正则表达式错误
                const escapedUserId = user.userid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                // 替换所有出现的该用户ID
                formattedContent = formattedContent.replace(new RegExp(escapedUserId, 'g'), userName)
            }
        })
        
        return formattedContent
    }

    if (loading || !ticket) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Spin size="large" />
            </div>
        )
    }

    // 获取图片数据，兼容移动端和PC端格式
    const getImages = () => {
        return ticket?.customFields?.images || ticket?.images || []
    }

    return (
        <>
            <div style={{ padding: "24px", background: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{
                background: '#fff',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '16px'
            }}>
                {/* 头部：工单标题和状态 */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "16px"
                }}>
                    <div style={{ flex: 1 }}>
                        <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
                            {cleanTitle(ticket.title)}
                        </Title>
                        <Space>
                            <Tag color={statusMap[ticket.status]?.color} style={{ fontSize: '14px', padding: '4px 12px' }}>
                                {statusMap[ticket.status]?.text}
                            </Tag>
                            <Tag color={priorityMap[ticket.priority]?.color} style={{ fontSize: '14px', padding: '4px 12px' }}>
                                {priorityMap[ticket.priority]?.text}
                            </Tag>
                            <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                                {typeMap[ticket.type]?.text}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: '14px' }}>
                                {ticket.ticketNo}
                            </Text>
                        </Space>
                    </div>
                    <Space>
                        {(ticket.status === "Pending" || ticket.status === "Assigned") && (
                            <Button type="primary" icon={<UserAddOutlined />} onClick={handleClaim} style={{ backgroundColor: "#000000" }}>
                                认领
                            </Button>
                        )}
                        {ticket.status === "Processing" && (
                            <>
                                <Button icon={<UserAddOutlined />} onClick={() => setAssignModalVisible(true)}>
                                    分配
                                </Button>
                                <Button type="primary" icon={<CheckOutlined />} onClick={() => setResolveModalVisible(true)} style={{ backgroundColor: "#000000" }}>
                                    标记解决
                                </Button>
                            </>
                        )}
                        {["Pending", "Processing", "Resolved"].includes(ticket.status) && (
                            <Button icon={<CloseOutlined />} onClick={handleClose}>
                                关闭
                            </Button>
                        )}
                        {ticket.status === "Closed" && (
                            <Button icon={<ReloadOutlined />} onClick={handleReopen}>
                                重新打开
                            </Button>
                        )}
                    </Space>
                </div>
            </div>

            <Row gutter={16}>
                {/* 左侧：主要内容 */}
                <Col span={16}>
                    {/* 工单详情 */}
                    <div style={{ marginBottom: '16px', background: '#fff', borderRadius: '8px', padding: '24px' }}>
                        <Title level={5} style={{ marginBottom: 20 }}>工单信息</Title>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>工单编号：</Text>
                                    <Text strong>{ticket.ticketNo}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>状态：</Text>
                                    <Tag color={statusMap[ticket.status]?.color}>
                                        {statusMap[ticket.status]?.text}
                                    </Tag>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>类型：</Text>
                                    <Text>{typeMap[ticket.type]?.text}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>优先级：</Text>
                                    <Tag color={priorityMap[ticket.priority]?.color}>
                                        {priorityMap[ticket.priority]?.text}
                                    </Tag>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>创建人：</Text>
                                    <Text>{getUserName(ticket.createdBy)}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>处理人：</Text>
                                    <Text>{getUserName(ticket.assignedTo)}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>创建时间：</Text>
                                    <Text>{FormatTime(ticket.createdAt)}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>更新时间：</Text>
                                    <Text>{FormatTime(ticket.updatedAt)}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>联系人：</Text>
                                    <Text>{ticket.labels?.contact_name || "-"}</Text>
                                </div>
                            </Col>
                            <Col span={12}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>联系电话：</Text>
                                    {ticket.labels?.contact_phone ? (
                                        <Space>
                                            <PhoneOutlined />
                                            <Text>{ticket.labels.contact_phone}</Text>
                                        </Space>
                                    ) : <Text>-</Text>}
                                </div>
                            </Col>
                            <Col span={24}>
                                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                                    <Text type="secondary" style={{ minWidth: '80px' }}>位置：</Text>
                                    {ticket.labels?.location ? (
                                        <Space>
                                            <EnvironmentOutlined />
                                            <Text>{ticket.labels.location}</Text>
                                        </Space>
                                    ) : <Text>-</Text>}
                                </div>
                            </Col>
                        </Row>
                        <Divider />
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>标题：</Text>
                            <Text strong style={{ fontSize: '16px' }}>{cleanTitle(ticket.title)}</Text>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary" style={{ marginBottom: 12, display: 'block', fontSize: '14px', fontWeight: 500 }}>故障描述：</Text>
                            {renderFaultDescription(getFaultDescription(ticket.description))}
                        </div>
                        {ticket.rootCause && (
                            <div style={{ marginBottom: 16 }}>
                                <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>根因分析：</Text>
                                <Paragraph style={{ margin: 0 }}>{ticket.rootCause}</Paragraph>
                            </div>
                        )}
                        {ticket.solution && (
                            <div>
                                <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>解决方案：</Text>
                                <Paragraph style={{ margin: 0 }}>{ticket.solution}</Paragraph>
                            </div>
                        )}
                        {ticket.knowledgeId && (
                            <div style={{ 
                                marginTop: 16, 
                                padding: '16px', 
                                background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)', 
                                borderRadius: '8px',
                                border: '1px solid #91d5ff'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                    <Space direction="vertical" size={8}>
                                        <Space>
                                            <FileTextOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
                                            <Text strong style={{ color: '#0050b3', fontSize: '14px' }}>已生成知识库</Text>
                                        </Space>
                                        <Space>
                                            <Tag color="blue" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                                ID: {ticket.knowledgeId}
                                            </Tag>
                                            <Button 
                                                type="primary" 
                                                size="small"
                                                icon={<FileTextOutlined />}
                                                onClick={() => window.open(`/knowledge/detail/${ticket.knowledgeId}`, '_blank')}
                                            >
                                                查看知识详情
                                            </Button>
                                        </Space>
                                    </Space>
                                    <div style={{ textAlign: 'right' }}>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            基于 <Tag color="green" style={{ margin: 0 }}>{steps.length}</Tag> 个处理步骤
                                        </Text>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 处理步骤区域 */}
                    <div style={{ marginBottom: '16px', background: '#fff', borderRadius: '8px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Title level={5} style={{ margin: 0 }}>
                                            处理步骤 ({steps.length})
                                        </Title>
                                        <Space>
                                            {(ticket.status === "Processing" || ticket.status === "Verifying") && (
                                                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddStepModal}>
                                                    添加步骤
                                                </Button>
                                            )}
                                            {steps.length > 0 && (
                                                <Button size="small" icon={<SendOutlined />} onClick={handleSyncToKnowledge}>
                                                    同步到知识库
                                                </Button>
                                            )}
                                        </Space>
                                    </div>
                                    {steps.length > 0 ? (
                                        <List
                                            dataSource={steps.sort((a, b) => a.order - b.order)}
                                            renderItem={(step, index) => (
                                                <List.Item
                                                    key={step.stepId}
                                                    actions={[
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            icon={<EditOutlined />}
                                                            onClick={() => handleEditStep(step)}
                                                            disabled={ticket.status !== "Processing" && ticket.status !== "Verifying"}
                                                        >
                                                            编辑
                                                        </Button>,
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => handleDeleteStep(step.stepId)}
                                                            disabled={ticket.status !== "Processing" && ticket.status !== "Verifying"}
                                                        >
                                                            删除
                                                        </Button>,
                                                    ]}
                                                >
                                                    <List.Item.Meta
                                                        avatar={
                                                            <div style={{
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: '50%',
                                                                background: '#1890ff',
                                                                color: '#fff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 'bold'
                                                            }}>
                                                                {step.order}
                                                            </div>
                                                        }
                                                        title={
                                                            <Space direction="vertical" size={4}>
                                                                <Space>
                                                                    <Text strong>{step.title}</Text>
                                                                    {step.attachments && step.attachments.length > 0 && (
                                                                        <Tag color="blue">{step.attachments.length}个附件</Tag>
                                                                    )}
                                                                </Space>
                                                                {step.knowledgeIds && step.knowledgeIds.length > 0 && (
                                                                    <div style={{ 
                                                                        marginTop: 8, 
                                                                        padding: '12px', 
                                                                        background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)', 
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #91d5ff'
                                                                    }}>
                                                                        <Space direction="vertical" size={6}>
                                                                            <Space size={4}>
                                                                                <FileTextOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                                                                                <Text style={{ color: '#0050b3', fontSize: '13px', fontWeight: 500 }}>关联知识库</Text>
                                                                            </Space>
                                                                            <Space size={4} wrap>
                                                                                {step.knowledgeIds.map(kid => {
                                                                                    const knowledge = knowledgeList.find(k => k.knowledgeId === kid)
                                                                                    return knowledge ? (
                                                                                        <Tag
                                                                                            key={kid}
                                                                                            color="blue"
                                                                                            style={{ fontSize: '12px', fontWeight: 'bold' }}
                                                                                        >
                                                                                            {knowledge.knowledgeId}
                                                                                        </Tag>
                                                                                    ) : (
                                                                                        <Tag key={kid} color="blue" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                                                                            {kid}
                                                                                        </Tag>
                                                                                    )
                                                                                })}
                                                                            </Space>
                                                                            <Space size={4} wrap>
                                                                                {step.knowledgeIds.map(kid => {
                                                                                    const knowledge = knowledgeList.find(k => k.knowledgeId === kid)
                                                                                    return knowledge ? (
                                                                                        <Button
                                                                                            key={kid}
                                                                                            type="primary"
                                                                                            size="small"
                                                                                            icon={<FileTextOutlined />}
                                                                                            onClick={() => window.open(`/knowledge/detail/${kid}`, '_blank')}
                                                                                        >
                                                                                            查看知识详情
                                                                                        </Button>
                                                                                    ) : null
                                                                                })}
                                                                            </Space>
                                                                        </Space>
                                                                    </div>
                                                                )}
                                                            </Space>
                                                        }
                                                        description={
                                                            <div>
                                                                {step.description && (
                                                                    <div style={{ marginBottom: 8 }}>
                                                                        <Text type="secondary">问题描述：</Text>
                                                                        <Text>{step.description}</Text>
                                                                    </div>
                                                                )}
                                                                {step.method && (
                                                                    <div style={{ marginBottom: 8 }}>
                                                                        <Text type="secondary">处理方法：</Text>
                                                                        <Text>{step.method}</Text>
                                                                    </div>
                                                                )}
                                                                {step.result && (
                                                                    <div>
                                                                        <Text type="secondary">验证结果：</Text>
                                                                        <Text>{step.result}</Text>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        }
                                                    />
                                                </List.Item>
                                            )}
                                        />
                                    ) : (
                                        <Empty
                                            description="暂无处理步骤"
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        />
                                    )}
                                </div>

                                {/* 图片展示区域 */}
                                {getImages().length > 0 && (
                                    <div style={{ marginBottom: '16px', background: '#fff', borderRadius: '8px', padding: '16px' }}>
                                        <Title level={5}>
                                            故障图片 ({getImages().length}张)
                                        </Title>
                                        <div style={{ 
                                            border: '1px solid #d9d9d9', 
                                            borderRadius: '8px', 
                                            padding: '16px',
                                            backgroundColor: '#fafafa'
                                        }}>
                                            <Carousel 
                                                autoplay={false} 
                                                dots={true} 
                                                arrows={true}
                                                afterChange={setCurrentImageIndex}
                                                ref={(carousel) => {
                                                    if (carousel) {
                                                        window.ticketCarousel = carousel
                                                    }
                                                }}
                                            >
                                                {getImages().map((image, index) => (
                                                    <div key={index}>
                                                        <div style={{
                                                            height: '300px',
                                                            display: 'flex',
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            background: '#fff',
                                                            cursor: 'pointer',
                                                            position: 'relative'
                                                        }}
                                                        onClick={() => {
                                                            setCurrentImageIndex(index)
                                                            setImagePreviewVisible(true)
                                                        }}
                                                        >
                                                            <img
                                                                src={image}
                                                                alt={`故障图片 ${index + 1}`}
                                                                style={{
                                                                    maxWidth: '100%',
                                                                    maxHeight: '100%',
                                                                    objectFit: 'contain'
                                                                }}
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none'
                                                                    e.target.nextSibling.style.display = 'flex'
                                                                }}
                                                            />
                                                            <div style={{
                                                                display: 'none',
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                                height: '100%',
                                                                color: '#999'
                                                            }}>
                                                                图片加载失败
                                                            </div>
                                                            <div style={{
                                                                position: 'absolute',
                                                                bottom: '8px',
                                                                right: '8px',
                                                                background: 'rgba(0, 0, 0, 0.6)',
                                                                color: 'white',
                                                                padding: '4px 8px',
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }}>
                                                                点击放大
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </Carousel>
                                             
                                            {/* 图片缩略图导航 */}
                                            <div style={{ 
                                                display: 'flex', 
                                                gap: '8px', 
                                                marginTop: '12px',
                                                justifyContent: 'center',
                                                flexWrap: 'wrap'
                                            }}>
                                                {getImages().map((image, index) => (
                                                    <div
                                                        key={index}
                                                        style={{
                                                            width: '50px',
                                                            height: '50px',
                                                            border: currentImageIndex === index ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                                            borderRadius: '4px',
                                                            overflow: 'hidden',
                                                            cursor: 'pointer',
                                                            opacity: currentImageIndex === index ? 1 : 0.6
                                                        }}
                                                        onClick={() => {
                                                            setCurrentImageIndex(index)
                                                            if (window.ticketCarousel) {
                                                                window.ticketCarousel.goTo(index)
                                                            }
                                                        }}
                                                    >
                                                        <img
                                                            src={image}
                                                            alt={`缩略图 ${index + 1}`}
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                objectFit: 'cover'
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            {/* 评论区 */}
                            <div style={{ background: '#fff', borderRadius: '8px', padding: '16px' }}>
                                <Title level={5}>评论</Title>
                                <List
                                    dataSource={comments}
                                    locale={{ emptyText: "暂无评论" }}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <List.Item.Meta
                                                avatar={<Avatar>{item.userName?.[0] || "U"}</Avatar>}
                                                title={
                                                    <Space>
                                                        <Text strong>{item.userName}</Text>
                                                        <Text type="secondary">{FormatTime(item.createdAt)}</Text>
                                                    </Space>
                                                }
                                                description={item.content}
                                            />
                                        </List.Item>
                                    )}
                                />
                                <Divider />
                                <Space.Compact style={{ width: "100%" }}>
                                    <TextArea
                                        rows={3}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="输入评论..."
                                        style={{ flex: 1 }}
                                    />
                                    <Button
                                        type="primary"
                                        icon={<SendOutlined />}
                                        loading={submitting}
                                        onClick={handleAddComment}
                                        style={{ backgroundColor: "#000000" }}
                                    >
                                        发送
                                    </Button>
                                </Space.Compact>
                            </div>
                        </Col>

                        {/* 右侧：工作日志 */}
                        <Col span={8}>
                            <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', position: 'sticky', top: '24px' }}>
                                <Title level={5}>工作日志</Title>
                                <Timeline
                                    items={workLogs.map((log) => ({
                                        children: (
                                            <div>
                                                <Text type="secondary">{FormatTime(log.createdAt)}</Text>
                                                <br />
                                                <Text>{formatWorkLogContent(log.content)}</Text>
                                                {log.oldValue && log.newValue && (
                                                    <div style={{ marginTop: 4 }}>
                                                        <Text type="secondary">
                                                            {getUserName(log.oldValue)} → {getUserName(log.newValue)}
                                                        </Text>
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    }))}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

            {/* 分配工单弹窗 */}
            <Modal
                title="分配工单"
                open={assignModalVisible}
                onCancel={() => {
                    setAssignModalVisible(false)
                    form.resetFields()
                }}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleAssign}>
                    <Form.Item
                        name="assignedTo"
                        label="分配给"
                        rules={[{ required: true, message: "请选择处理人" }]}
                    >
                        <Select
                            placeholder="请选择处理人"
                            showSearch
                            allowClear
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={userList.map(user => ({
                                label: user.username || user.userid,
                                value: user.userid,
                            }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 标记解决弹窗 */}
            <Modal
                title="标记解决"
                open={resolveModalVisible}
                onCancel={() => {
                    setResolveModalVisible(false)
                    form.resetFields()
                }}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleResolve}>
                    <Form.Item
                        name="solution"
                        label="解决方案"
                        rules={[{ required: true, message: "请输入解决方案" }]}
                    >
                        <TextArea rows={4} placeholder="请输入解决方案" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 添加/编辑步骤弹窗 */}
            <Modal
                title={editingStep ? "编辑步骤" : "添加步骤"}
                open={stepModalVisible}
                onCancel={() => {
                    setStepModalVisible(false)
                    stepForm.resetFields()
                    setEditingStep(null)
                }}
                onOk={() => stepForm.submit()}
                width={700}
            >
                <Form form={stepForm} layout="vertical" onFinish={editingStep ? handleUpdateStep : handleAddStep}>
                    <Form.Item
                        name="title"
                        label="步骤标题"
                        rules={[{ required: true, message: "请输入步骤标题" }]}
                    >
                        <Input placeholder="请输入步骤标题" />
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="问题描述"
                        rules={[{ required: true, message: "请输入问题描述" }]}
                    >
                        <TextArea rows={3} placeholder="请描述问题的详细情况" />
                    </Form.Item>
                    {!editingStep && (
                        <Form.Item label="知识库参考">
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button
                                    icon={<SearchOutlined />}
                                    onClick={openKnowledgeSelector}
                                    style={{ width: '100%' }}
                                >
                                    选择知识库
                                </Button>
                                {selectedKnowledge && (
                                    <Card 
                                        size="small" 
                                        style={{ 
                                            backgroundColor: '#e6f7ff',
                                            border: '2px solid #1890ff'
                                        }}
                                    >
                                        <Space direction="vertical" style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Space>
                                                    <FileTextOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                                                    <Text strong style={{ color: '#1890ff' }}>{selectedKnowledge.title}</Text>
                                                </Space>
                                                <Tag color="blue" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                                    ID: {selectedKnowledge.knowledgeId}
                                                </Tag>
                                            </div>
                                            <Space size={8}>
                                                {selectedKnowledge.category && (
                                                    <Tag color="purple">{selectedKnowledge.category}</Tag>
                                                )}
                                                {selectedKnowledge.tags && selectedKnowledge.tags.length > 0 && (
                                                    selectedKnowledge.tags.slice(0, 2).map((tag, idx) => (
                                                        <Tag key={idx} color="cyan">{tag}</Tag>
                                                    ))
                                                )}
                                                <Tag color="green">
                                                    <EyeOutlined /> {selectedKnowledge.viewCount || 0}
                                                </Tag>
                                                <Tag color="orange">
                                                    <FileTextOutlined /> {selectedKnowledge.useCount || 0}
                                                </Tag>
                                            </Space>
                                            <div 
                                                style={{ 
                                                    maxHeight: '100px', 
                                                    overflow: 'hidden',
                                                    fontSize: '12px',
                                                    color: '#666',
                                                    lineHeight: '1.5'
                                                }}
                                                dangerouslySetInnerHTML={{ 
                                                    __html: selectedKnowledge.content?.substring(0, 300) + (selectedKnowledge.content?.length > 300 ? '...' : '') 
                                                }} 
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                    创建于 {FormatTime(selectedKnowledge.createdAt)}
                                                </Text>
                                                <Button 
                                                    type="link" 
                                                    size="small" 
                                                    onClick={() => setSelectedKnowledge(null)}
                                                    danger
                                                >
                                                    取消关联
                                                </Button>
                                            </div>
                                        </Space>
                                    </Card>
                                )}
                            </Space>
                        </Form.Item>
                    )}
                    <Form.Item
                        name="method"
                        label="处理方法"
                        rules={[{ required: true, message: "请输入处理方法" }]}
                    >
                        <TextArea rows={4} placeholder="请详细描述处理步骤和方法" />
                    </Form.Item>
                    <Form.Item
                        name="result"
                        label="验证结果"
                    >
                        <TextArea rows={3} placeholder="请描述验证结果" />
                    </Form.Item>
                    <Form.Item name="attachments" label="附件">
                        <Input placeholder="附件URL（多个用逗号分隔）" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 知识库选择器Modal */}
            <Modal
                title="选择知识库"
                open={knowledgeSelectorVisible}
                onCancel={() => setKnowledgeSelectorVisible(false)}
                footer={null}
                width={1200}
            >
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    <Row gutter={16}>
                        <Col span={16}>
                            <Input.Search
                                placeholder="搜索知识库标题或内容"
                                value={knowledgeSelectorSearch}
                                onChange={(e) => setKnowledgeSelectorSearch(e.target.value)}
                                onSearch={handleKnowledgeSelectorSearch}
                                allowClear
                            />
                        </Col>
                        <Col span={8}>
                            <Select
                                placeholder="按分类筛选"
                                value={knowledgeSelectorFilter}
                                onChange={handleKnowledgeSelectorFilterChange}
                                allowClear
                                style={{ width: '100%' }}
                            >
                                {knowledgeCategories.map((cat) => (
                                    <Select.Option key={cat.id} value={cat.name}>
                                        {cat.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Col>
                    </Row>

                    {allKnowledgeTags.length > 0 && (
                        <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
                            <Text type="secondary" style={{ fontSize: '13px', marginBottom: 8, display: 'block' }}>
                                按标签筛选：
                            </Text>
                            <Space size={8} wrap>
                                {allKnowledgeTags.map((tag) => (
                                    <Tag
                                        key={tag}
                                        color={knowledgeSelectorTagFilter === tag ? 'blue' : 'default'}
                                        style={{ 
                                            cursor: 'pointer', 
                                            marginBottom: 4,
                                            border: knowledgeSelectorTagFilter === tag ? '1px solid #1890ff' : '1px solid #d9d9d9'
                                        }}
                                        onClick={() => handleKnowledgeSelectorTagFilterChange(tag)}
                                    >
                                        {tag}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    )}

                    <List
                        dataSource={knowledgeSelectorList}
                        loading={knowledgeSelectorLoading}
                        grid={{
                            gutter: 16,
                            xs: 1,
                            sm: 1,
                            md: 1,
                            lg: 1,
                            xl: 1,
                            xxl: 1,
                        }}
                        pagination={{
                            ...knowledgeSelectorPagination,
                            showSizeChanger: true,
                            showTotal: (total) => `共 ${total} 条`,
                        }}
                        renderItem={(item) => (
                            <List.Item>
                                <Card
                                    hoverable
                                    onClick={() => handleSelectKnowledge(item)}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                    bodyStyle={{ padding: '20px' }}
                                >
                                    <Row gutter={16}>
                                        <Col span={24}>
                                            <Space direction="vertical" style={{ width: '100%' }} size={12}>
                                                {/* 头部信息 */}
                                                <Row justify="space-between" align="middle">
                                                    <Space size={12}>
                                                        <Tag color="blue" style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                                            {item.knowledgeId}
                                                        </Tag>
                                                        {item.category && (
                                                            <Tag color="purple">{item.category}</Tag>
                                                        )}
                                                        <Space size={4} wrap>
                                                            {item.tags && item.tags.slice(0, 5).map((tag, idx) => (
                                                                <Tag key={idx} color="cyan" style={{ fontSize: '12px' }}>
                                                                    {tag}
                                                                </Tag>
                                                            ))}
                                                            {item.tags && item.tags.length > 5 && (
                                                                <Tag style={{ fontSize: '12px' }}>+{item.tags.length - 5}</Tag>
                                                            )}
                                                        </Space>
                                                    </Space>
                                                    <Space size={12}>
                                                        <Tag color="green" icon={<EyeOutlined />}>
                                                            {item.viewCount || 0}
                                                        </Tag>
                                                        <Tag color="orange" icon={<FileTextOutlined />}>
                                                            {item.useCount || 0}
                                                        </Tag>
                                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                                            {FormatTime(item.createdAt)}
                                                        </Text>
                                                    </Space>
                                                </Row>

                                                {/* 标题 */}
                                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#262626' }}>
                                                    <FileTextOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                                                    {item.title}
                                                </div>

                                                {/* 内容预览 */}
                                                <div
                                                    style={{
                                                        padding: '12px',
                                                        background: '#f5f5f5',
                                                        borderRadius: '6px',
                                                        fontSize: '13px',
                                                        color: '#555',
                                                        lineHeight: '1.6',
                                                        maxHeight: '200px',
                                                        overflow: 'auto',
                                                        border: '1px solid #e8e8e8'
                                                    }}
                                                    dangerouslySetInnerHTML={{
                                                        __html: item.content || item.contentText || '暂无内容'
                                                    }}
                                                />
                                            </Space>
                                        </Col>
                                    </Row>
                                </Card>
                            </List.Item>
                        )}
                    />
                </Space>
            </Modal>

            {/* 同步到知识库Modal */}
            <Modal
                title="同步到知识库"
                open={knowledgeModalVisible}
                onCancel={() => {
                    setKnowledgeModalVisible(false)
                    knowledgeForm.resetFields()
                    setKnowledgeTags([])
                    setKnowledgeTagInput('')
                }}
                onOk={() => knowledgeForm.submit()}
                width={800}
            >
                <Form form={knowledgeForm} layout="vertical" onFinish={handleCreateKnowledge}>
                    <Form.Item
                        name="title"
                        label="知识标题"
                        rules={[{ required: true, message: "请输入知识标题" }]}
                    >
                        <Input placeholder="请输入知识标题" />
                    </Form.Item>
                    <Form.Item
                        name="category"
                        label="知识分类"
                        rules={[{ required: true, message: "请选择知识分类" }]}
                    >
                        <Select placeholder="请选择知识分类">
                            {knowledgeCategories.map(cat => (
                                <Select.Option key={cat.categoryId} value={cat.name}>
                                    {cat.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item label="标签">
                        <Space.Compact style={{ width: "100%" }}>
                            <Input
                                value={knowledgeTagInput}
                                onChange={(e) => setKnowledgeTagInput(e.target.value)}
                                onPressEnter={handleAddKnowledgeTag}
                                placeholder="输入标签后按回车"
                            />
                            <Button type="primary" onClick={handleAddKnowledgeTag}>
                                添加
                            </Button>
                        </Space.Compact>
                        <div style={{ marginTop: 8 }}>
                            {knowledgeTags.map((tag) => (
                                <Tag
                                    key={tag}
                                    closable
                                    onClose={() => handleRemoveKnowledgeTag(tag)}
                                    style={{ marginBottom: 8 }}
                                >
                                    {tag}
                                </Tag>
                            ))}
                            {knowledgeTags.length === 0 && (
                                <Text type="secondary" style={{ fontSize: '14px' }}>
                                    暂无标签
                                </Text>
                            )}
                        </div>
                    </Form.Item>
                    <Form.Item
                        name="content"
                        label="知识内容"
                        rules={[{ required: true, message: "请输入知识内容" }]}
                    >
                        <TextArea rows={15} placeholder="请输入知识内容（支持HTML）" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 图片预览Modal */}
            <Modal
                open={imagePreviewVisible}
                onCancel={() => setImagePreviewVisible(false)}
                footer={null}
                width="90%"
                style={{ top: 20 }}
                title={
                    <div style={{ textAlign: 'center' }}>
                        故障图片预览 ({currentImageIndex + 1}/{getImages().length})
                    </div>
                }
            >
                {getImages().length > 0 && (
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                        <Image
                            src={getImages()[currentImageIndex]}
                            alt={`故障图片 ${currentImageIndex + 1}`}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '70vh',
                                objectFit: 'contain'
                            }}
                            preview={false}
                        />
                        
                        {/* 左右切换按钮 */}
                        {currentImageIndex > 0 && (
                            <Button
                                type="text"
                                icon={<span style={{ fontSize: '24px' }}>‹</span>}
                                style={{
                                    position: 'absolute',
                                    left: '20px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '24px',
                                    background: 'rgba(0, 0, 0, 0.5)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px'
                                }}
                                onClick={() => setCurrentImageIndex(currentImageIndex - 1)}
                            />
                        )}
                         
                        {currentImageIndex < getImages().length - 1 && (
                            <Button
                                type="text"
                                icon={<span style={{ fontSize: '24px' }}>›</span>}
                                style={{
                                    position: 'absolute',
                                    right: '20px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '24px',
                                    background: 'rgba(0, 0, 0, 0.5)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '40px',
                                    height: '40px'
                                }}
                                onClick={() => setCurrentImageIndex(currentImageIndex + 1)}
                            />
                        )}
                        
                        {/* 缩略图导航 */}
                        <div style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            justifyContent: 'center',
                            marginTop: '20px',
                            flexWrap: 'wrap'
                        }}>
                            {getImages().map((image, index) => (
                                <div
                                    key={index}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        border: currentImageIndex === index ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        opacity: currentImageIndex === index ? 1 : 0.6
                                    }}
                                    onClick={() => setCurrentImageIndex(index)}
                                >
                                    <img
                                        src={image}
                                        alt={`缩略图 ${index + 1}`}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    )
}