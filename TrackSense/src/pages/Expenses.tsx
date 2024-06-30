import axios from 'axios'
import { useState, useEffect } from 'react'


const Expenses = () => {
    const [expenses, setExpenses] = useState([])
    useEffect(() => {
        axios.get('http://localhost:3000/expenses')
            .then((response) => {
                setExpenses(response.data.expenses)
            })
            .catch((err) => console.log(err))
    }, [])

    return (
        expenses?.map((expense: any) => {
            return (
                <div key={expense._id}>
                    <h1>{expense.date}</h1>
                    <p>{expense.vendor}</p>
                    <p>{expense.amount}</p>
                    {expense.comments ? <p>expense.comments</p> : ""}
                </div>
            )
        })
    )
}

export default Expenses