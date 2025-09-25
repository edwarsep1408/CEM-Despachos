export class AddForm {
  constructor(
    public nombre: string,
    public bodega: string,
  ) { }
}


export class EditForm {
  constructor(
    public _id: string,
    public nombre: string,
    public bodega: string,
  ) { }
}
